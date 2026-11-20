import React, { useEffect, useState } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions, Easing } from 'react-native';

const { width, height } = Dimensions.get('window');
const EMOJI_COUNT = 22;

export default function FloatingEmojis({ emoji, text }) {
  const [emojis, setEmojis] = useState([]);

  useEffect(() => {
    const newEmojis = Array.from({ length: EMOJI_COUNT }).map((_, i) => ({
      id: i,
      x: Math.random() * (width - 60),
      size: Math.random() * 18 + 34,
      translateY: new Animated.Value(height),
      opacity: new Animated.Value(0),
      translateX: new Animated.Value(Math.random() * (width - 60)),
    }));

    setEmojis(newEmojis);

    const runningAnimations = [];

    newEmojis.forEach((e) => {
      const duration = Math.random() * 2500 + 3000;
      const delay = Math.random() * 1000;
      const swayAmount = Math.random() * 45 + 25;

      const mainAnim = Animated.parallel([
        Animated.timing(e.translateY, {
          toValue: -150,
          duration: duration,
          delay: delay,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(e.opacity, {
            toValue: 1,
            duration: 600,
            delay: delay,
            useNativeDriver: true,
          }),
          Animated.timing(e.opacity, {
            toValue: 0,
            duration: Math.max(500, duration - 600),
            useNativeDriver: true,
          }),
        ]),
      ]);

      const loopAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(e.translateX, {
            toValue: e.x + swayAmount,
            duration: 1200 + Math.random() * 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(e.translateX, {
            toValue: e.x - swayAmount,
            duration: 2400 + Math.random() * 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(e.translateX, {
            toValue: e.x,
            duration: 1200 + Math.random() * 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      runningAnimations.push(mainAnim, loopAnim);
      mainAnim.start();
      loopAnim.start();
    });

    return () => {
      runningAnimations.forEach((anim) => {
        try {
          anim.stop();
        } catch (err) {}
      });
    };
  }, [emoji, text]);

  return (
    <View style={styles.container} pointerEvents="none">
      {emojis.map((e) => (
        <Animated.View
          key={e.id}
          style={[
            styles.emojiContainer,
            {
              transform: [{ translateY: e.translateY }, { translateX: e.translateX }],
              opacity: e.opacity,
            },
          ]}
        >
          <Text
            style={[
              styles.emoji,
              {
                fontSize: e.size,
                lineHeight: e.size * 1.4,
              },
            ]}
          >
            {emoji}
          </Text>
          {text ? <Text style={[styles.floatingText, { fontSize: Math.max(12, e.size * 0.35) }]}>{text}</Text> : null}
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  emojiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    includeFontPadding: false,
    textAlignVertical: 'center',
    padding: 8,
  },
  floatingText: {
    color: '#ff6b81',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: -6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
