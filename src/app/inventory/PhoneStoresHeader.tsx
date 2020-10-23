import { hideItemPopup } from 'app/item-popup/item-popup';
import { animate, motion, PanInfo, Spring, useMotionValue, useTransform } from 'framer-motion';
import React, { useEffect, useRef } from 'react';
import StoreHeading from '../character-tile/StoreHeading';
import styles from './PhoneStoresHeader.m.scss';
import { DimStore } from './store-types';

const spring: Spring = {
  type: 'spring',
  stiffness: 100,
  damping: 20,
  mass: 1,
  restSpeed: 0.01,
  restDelta: 0.01,
};

const wrap = (index: number, length: number) => {
  while (index < 0) {
    index += length;
  }
  while (index >= length) {
    index -= length;
  }
  return index;
};

/**
 * The swipable header for the mobile (phone portrait) Inventory view.
 */
export default function PhoneStoresHeader({
  selectedStore,
  stores,
  setSelectedStoreId,
  loadoutMenuRef,
}: {
  selectedStore: DimStore;
  stores: DimStore[];
  loadoutMenuRef: React.RefObject<HTMLElement>;
  setSelectedStoreId(id: string): void;
}) {
  const onIndexChanged = (index: number) => {
    const originalIndex = stores.indexOf(selectedStore);
    setSelectedStoreId(stores[wrap(originalIndex + index, stores.length)].id);
    hideItemPopup();
  };

  // TODO: carousel
  // TODO: wrap StoreHeading in a div?
  // TODO: optional external motion control

  const index = stores.indexOf(selectedStore);
  const lastIndex = useRef(index);

  // stores = stores.map((_, i) => stores[wrap(i - index - 1, stores.length)]);

  const trackRef = useRef<HTMLDivElement>(null);

  // The track is divided into "segments", with one item per segment
  const numSegments = stores.length;
  // This is a floating-point, animated representation of the position within the segments, relative to the current store
  const offset = useMotionValue(2);
  // Keep track of the starting point when we begin a gesture
  const startOffset = useRef<number>(0);

  useEffect(() => {
    let diff = index - lastIndex.current;
    if (lastIndex.current === 0 && diff > 1) {
      diff = -1;
    } else if (lastIndex.current === numSegments - 1 && diff < -1) {
      diff = 1;
    }

    const velocity = offset.getVelocity();
    offset.set(offset.get() - diff);
    animate(offset, 0, { ...spring, velocity });
    lastIndex.current = index;
  }, [index, offset, numSegments]);

  // We want a bit more control than Framer Motion's drag gesture can give us, so fall
  // back to the pan gesture and implement our own elasticity, etc.
  const onPanStart = () => {
    startOffset.current = offset.get();
  };

  const onPan = (_e, info: PanInfo) => {
    if (!trackRef.current) {
      return;
    }
    const trackWidth = trackRef.current.clientWidth;
    // The offset as a proportion of segments
    const newValue = startOffset.current + -info.offset.x / (trackWidth / numSegments);

    offset.set(newValue);
  };

  const onPanEnd = (_e, info: PanInfo) => {
    // Animate to one of the settled whole-number indexes
    let newIndex = Math.round(offset.get());
    const scale = trackRef.current!.clientWidth / numSegments;

    if (newIndex === 0) {
      const swipe = (info.velocity.x * info.offset.x) / (scale * scale);
      if (swipe > 0.05) {
        const direction = -Math.sign(info.velocity.x);
        newIndex = newIndex + direction;
      }
    }

    if (newIndex !== 0) {
      onIndexChanged(newIndex);
    } else {
      /*
    const velocity = offset.getVelocity();
    offset.set(offset.get() - newIndex);
    animate(offset, 0, { ...spring, velocity });
    */
      animate(offset, 0, spring);
    }
  };

  // Expand out from the selected index in each direction 2 items
  const segments: DimStore[] = [];
  for (let i = index - 2; i <= index + 2; i++) {
    segments.push(stores[wrap(i, stores.length)]);
  }

  // Transform the segment-relative offset back into pixels
  const offsetPercent = useTransform(offset, (o) =>
    trackRef.current ? (trackRef.current.clientWidth / segments.length) * -(o + 2) : 0
  );

  return (
    <div className={styles.frame}>
      <motion.div
        ref={trackRef}
        className={styles.track}
        onPanStart={onPanStart}
        onPan={onPan}
        onPanEnd={onPanEnd}
        style={{ width: `${100 * segments.length}%`, x: offsetPercent }}
      >
        {segments.map((store, index) => (
          <div
            className="store-cell"
            key={index}
            style={{ width: `${Math.floor(100 / segments.length)}%` }}
          >
            <StoreHeading
              store={store}
              selectedStore={selectedStore}
              onTapped={setSelectedStoreId}
              loadoutMenuRef={loadoutMenuRef}
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
