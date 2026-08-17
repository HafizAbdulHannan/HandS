import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';

const DraggableItem = ({ children, initialX, initialY, zIndex = 100 }) => {
  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e, gestureState) => {
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (e, gestureState) => {
        pan.flattenOffset();
      },
      onPanResponderTerminate: (e, gestureState) => {
        pan.flattenOffset();
      }
    })
  ).current;

  return (
    <Animated.View
      style={[
        pan.getLayout(),
        styles.draggable,
        { zIndex }
      ]}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  draggable: {
    position: 'absolute',
  }
});

export default DraggableItem;
