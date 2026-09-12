import React, { useState, useRef } from 'react';
import { 
  View, StyleSheet, TouchableOpacity, Text, 
  PanResponder, Dimensions, Image, ActivityIndicator, TextInput, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemeContext } from '../context/ThemeContext';
import Svg, { Path, Rect, Circle, Polygon } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import * as ImagePicker from 'expo-image-picker';
import axiosInstance from '../api/axiosConfig';
import Toast from 'react-native-toast-message';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import DraggableItem from '../components/DraggableItem';
const { width, height } = Dimensions.get('window');
const COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FFFFFF', '#000000'];
const STROKES = [2, 5, 10, 20];
const STICKERS = ['❤️', '😂', '🔥', '✨', '🥺', '🎉', '🌟', '🍿'];

export default function DrawFunScreen() {
  const { theme } = useThemeContext();
  const navigation = useNavigation();
  const viewShotRef = useRef(null);

  const [paths, setPaths] = useState([]);
  const [redoPaths, setRedoPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(5);
  
  const [bgImage, setBgImage] = useState(null);
  const [placedElements, setPlacedElements] = useState([]);
  const [redoElements, setRedoElements] = useState([]);
  
  const [showTools, setShowTools] = useState(false);
  const [toolMode, setToolMode] = useState('draw'); // 'draw', 'move', 'color', 'stroke', 'sticker', 'shape', 'text'
  const [isPosting, setIsPosting] = useState(false);
  const [textInput, setTextInput] = useState('');

  const toolModeRef = useRef(toolMode);
  React.useEffect(() => {
    toolModeRef.current = toolMode;
  }, [toolMode]);

  const handlePanResponderGrant = (evt) => {
    if (toolModeRef.current !== 'draw' && toolModeRef.current !== 'eraser') return;
    const { locationX, locationY } = evt.nativeEvent;
    setCurrentPath({
      path: `M${locationX},${locationY}`,
      color: toolModeRef.current === 'eraser' ? theme.colors.background : color,
      strokeWidth
    });
  };

  const handlePanResponderMove = (evt) => {
    if ((toolModeRef.current !== 'draw' && toolModeRef.current !== 'eraser') || !currentPath) return;
    const { locationX, locationY } = evt.nativeEvent;
    setCurrentPath((prev) => ({
      ...prev,
      path: `${prev.path} L${locationX},${locationY}`
    }));
  };

  const handlePanResponderRelease = () => {
    if (currentPath) {
      setPaths([...paths, currentPath]);
      setRedoPaths([]); // Clear redo stack on new action
      setCurrentPath(null);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => toolModeRef.current === 'draw' || toolModeRef.current === 'eraser',
      onMoveShouldSetPanResponder: () => toolModeRef.current === 'draw' || toolModeRef.current === 'eraser',
      onStartShouldSetPanResponderCapture: () => toolModeRef.current === 'draw' || toolModeRef.current === 'eraser',
      onMoveShouldSetPanResponderCapture: () => toolModeRef.current === 'draw' || toolModeRef.current === 'eraser',
      onPanResponderGrant: handlePanResponderGrant,
      onPanResponderMove: handlePanResponderMove,
      onPanResponderRelease: handlePanResponderRelease,
    })
  ).current;

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets) {
      const asset = result.assets[0];
      setBgImage(`data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`);
    }
  };

  const addSticker = (sticker) => {
    setPlacedElements([...placedElements, { type: 'sticker', content: sticker, x: width/2 - 20, y: height/3 }]);
    setRedoElements([]);
    setShowTools(false);
    setToolMode('move');
  };

  const addText = () => {
    if (textInput.trim()) {
      setPlacedElements([...placedElements, { type: 'text', content: textInput, x: width/2 - 40, y: height/3, color }]);
      setRedoElements([]);
      setTextInput('');
      setShowTools(false);
      setToolMode('move');
    }
  };

  const addShape = (shape) => {
    setPlacedElements([...placedElements, { type: 'shape', shape, color, x: width/2 - 50, y: height/3 }]);
    setRedoElements([]);
    setShowTools(false);
    setToolMode('move');
  };

  const clearCanvas = () => {
    setPaths([]);
    setPlacedElements([]);
    setBgImage(null);
    Toast.show({ type: 'success', text1: 'Canvas Cleared' });
  };

  const undo = () => {
    if (paths.length > 0) {
      const lastPath = paths[paths.length - 1];
      setRedoPaths([...redoPaths, lastPath]);
      setPaths(paths.slice(0, -1));
    } else if (placedElements.length > 0) {
      const lastEl = placedElements[placedElements.length - 1];
      setRedoElements([...redoElements, lastEl]);
      setPlacedElements(placedElements.slice(0, -1));
    }
  };

  const redo = () => {
    if (redoPaths.length > 0) {
      const pathToRestore = redoPaths[redoPaths.length - 1];
      setPaths([...paths, pathToRestore]);
      setRedoPaths(redoPaths.slice(0, -1));
    } else if (redoElements.length > 0) {
      const elToRestore = redoElements[redoElements.length - 1];
      setPlacedElements([...placedElements, elToRestore]);
      setRedoElements(redoElements.slice(0, -1));
    }
  };

  const handlePost = async () => {
    if (paths.length === 0 && placedElements.length === 0 && !bgImage) {
      Toast.show({ type: 'info', text1: 'Empty canvas', text2: 'Draw something first!' });
      return;
    }

    setIsPosting(true);
    try {
      const uri = await viewShotRef.current.capture();
      const formData = new FormData();
      formData.append('media', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: 'drawing.jpg',
        type: 'image/jpeg'
      });

      const uploadRes = await axiosInstance.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const finalUrl = uploadRes.data;

      await axiosInstance.post('/posts', {
        content: 'Check out my drawing! 🎨',
        mediaUrl: finalUrl,
        mediaType: 'drawing'
      });

      Toast.show({ type: 'success', text1: 'Sent!', text2: 'Your partner has been notified.' });
      navigation.goBack();
    } catch (error) {
      console.log('Error posting drawing:', error);
      Toast.show({ type: 'error', text1: 'Failed to post', text2: 'Please try again later' });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
        {/* Header */}
      <View style={[styles.header, { zIndex: 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handlePost} style={styles.postBtn} disabled={isPosting}>
          {isPosting ? <ActivityIndicator color="#fff" /> : <Text style={styles.postText}>Post</Text>}
        </TouchableOpacity>
      </View>

      {/* Canvas */}
      <View style={styles.canvasContainer}>
        <ViewShot ref={viewShotRef} style={styles.viewShot} options={{ format: 'jpg', quality: 0.8, result: 'tmpfile' }}>
          <View collapsable={false} style={styles.canvasBackground} {...panResponder.panHandlers}>
            {bgImage && <Image source={{ uri: bgImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
            
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              {paths.map((p, i) => (
                <Path key={i} d={p.path} stroke={p.color} strokeWidth={p.strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              ))}
              {currentPath && (
                <Path d={currentPath.path} stroke={currentPath.color} strokeWidth={currentPath.strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              )}
            </Svg>

            {placedElements.map((el, i) => {
              if (el.type === 'sticker') {
                return (
                  <DraggableItem key={i} initialX={el.x} initialY={el.y}>
                    <Text style={{ fontSize: 50 }}>{el.content}</Text>
                  </DraggableItem>
                );
              }
              if (el.type === 'text') {
                return (
                  <DraggableItem key={i} initialX={el.x} initialY={el.y}>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: el.color }}>{el.content}</Text>
                  </DraggableItem>
                );
              }
              if (el.type === 'shape') {
                return (
                  <DraggableItem key={i} initialX={el.x} initialY={el.y}>
                    <Svg height="100" width="100">
                      {el.shape === 'rect' && <Rect width="100" height="100" fill={el.color} />}
                      {el.shape === 'circle' && <Circle cx="50" cy="50" r="50" fill={el.color} />}
                      {el.shape === 'triangle' && <Polygon points="50,0 100,100 0,100" fill={el.color} />}
                      {el.shape === 'star' && <Polygon points="50,0 60,35 100,35 70,60 80,100 50,75 20,100 30,60 0,35 40,35" fill={el.color} />}
                      {el.shape === 'heart' && <Path d="M50,90 L42,82 C14,56 0,42 0,25 C0,11 11,0 25,0 C33,0 40,4 45,10 C50,4 57,0 65,0 C79,0 90,11 90,25 C90,42 76,56 48,82 L50,90 Z" fill={el.color} transform="translate(5, 5)" />}
                    </Svg>
                  </DraggableItem>
                );
              }
              return null;
            })}
          </View>
        </ViewShot>
      </View>

      {/* Toolbar */}
      <View style={[styles.toolbar, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity style={styles.toolBtn} onPress={() => { setToolMode('color'); setShowTools(true); }}>
          <View style={[styles.colorPreview, { backgroundColor: color }]} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn} onPress={() => { setToolMode('stroke'); setShowTools(true); }}>
          <Ionicons name="pencil" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn} onPress={() => { setToolMode('sticker'); setShowTools(true); }}>
          <Ionicons name="happy-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn} onPress={() => { setToolMode('text'); setShowTools(true); }}>
          <Ionicons name="text-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.toolBtn} onPress={() => { setToolMode('shape'); setShowTools(true); }}>
          <Ionicons name="shapes-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={() => {
          setColor('#ffffff');
          setStrokeWidth(20);
          setToolMode('eraser');
          Toast.show({ type: 'info', text1: 'Eraser active', text2: 'Draw to erase (white color)' });
        }}>
          <Ionicons name="scan-outline" size={24} color={toolMode === 'eraser' ? theme.colors.primary : theme.colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn} onPress={clearCanvas}>
          <Ionicons name="trash-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn} onPress={pickImage}>
          <Ionicons name="image-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.toolBtn} onPress={undo}>
          <Ionicons name="arrow-undo-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn} onPress={redo}>
          <Ionicons name="arrow-redo-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tools Panel */}
      {showTools && (
        <Animated.View entering={SlideInDown} style={[styles.toolsPanel, { backgroundColor: theme.colors.cardBg, shadowColor: theme.colors.text }]}>
          <View style={styles.toolsPanelHeader}>
            <Text style={{ color: theme.colors.text, fontWeight: 'bold' }}>
              {toolMode === 'color' && 'Select Color'}
              {toolMode === 'stroke' && 'Pen Thickness'}
              {toolMode === 'sticker' && 'Add Sticker'}
              {toolMode === 'shape' && 'Add Shape'}
            </Text>
            <TouchableOpacity onPress={() => { setShowTools(false); setToolMode('draw'); }}>
              <Ionicons name="close-circle" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.toolsContent}>
            {toolMode === 'color' && COLORS.map(c => (
              <TouchableOpacity key={c} onPress={() => { setColor(c); setShowTools(false); setToolMode('draw'); }} style={[styles.colorCircle, { backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: theme.colors.text }]} />
            ))}

            {toolMode === 'stroke' && STROKES.map(s => (
              <TouchableOpacity key={s} onPress={() => { setStrokeWidth(s); setShowTools(false); setToolMode('draw'); }} style={styles.strokeBtn}>
                <View style={{ width: 40, height: s, backgroundColor: theme.colors.text, borderRadius: s/2 }} />
              </TouchableOpacity>
            ))}

            {toolMode === 'sticker' && STICKERS.map(s => (
              <TouchableOpacity key={s} onPress={() => addSticker(s)} style={styles.stickerBtn}>
                <Text style={{ fontSize: 32 }}>{s}</Text>
              </TouchableOpacity>
            ))}

            {toolMode === 'text' && (
              <View style={{ width: '100%', paddingHorizontal: 20 }}>
                <TextInput
                  style={[styles.textInputStyle, { borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Enter text..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={textInput}
                  onChangeText={setTextInput}
                  autoFocus
                />
                <TouchableOpacity onPress={addText} style={[styles.addTextBtn, { backgroundColor: theme.colors.primary }]}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add Text</Text>
                </TouchableOpacity>
              </View>
            )}

            {toolMode === 'shape' && (
              <>
                <TouchableOpacity onPress={() => addShape('rect')} style={styles.shapeBtn}>
                  <View style={{ width: 40, height: 40, backgroundColor: color }} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => addShape('circle')} style={styles.shapeBtn}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color }} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => addShape('triangle')} style={styles.shapeBtn}>
                  <Svg height="40" width="40"><Polygon points="20,0 40,40 0,40" fill={color} /></Svg>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => addShape('star')} style={styles.shapeBtn}>
                  <Svg height="40" width="40"><Polygon points="20,0 24,14 40,14 28,24 32,40 20,30 8,40 12,24 0,14 16,14" fill={color} /></Svg>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => addShape('heart')} style={styles.shapeBtn}>
                  <Svg height="40" width="40"><Path d="M20,36 L17,33 C6,22 0,17 0,10 C0,4 4,0 10,0 C13,0 16,2 18,4 C20,2 23,0 26,0 C32,0 36,4 36,10 C36,17 30,22 19,33 L20,36 Z" fill={color} transform="translate(2, 2)" /></Svg>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'absolute',
    top: 50,
    width: '100%'
  },
  iconBtn: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20
  },
  postBtn: {
    backgroundColor: '#ff6b81',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#ff6b81',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  postText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  canvasContainer: {
    flex: 1,
  },
  viewShot: {
    flex: 1,
  },
  canvasBackground: {
    flex: 1,
    backgroundColor: '#fff',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    borderTopWidth: 1,
  },
  toolBtn: {
    padding: 10,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333'
  },
  toolsPanel: {
    position: 'absolute',
    bottom: 80,
    left: 10,
    right: 10,
    borderRadius: 20,
    padding: 15,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  toolsPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15
  },
  toolsContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    justifyContent: 'center'
  },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  strokeBtn: {
    padding: 10,
    justifyContent: 'center',
  },
  stickerBtn: {
    padding: 5,
  },
  shapeBtn: {
    padding: 10,
  },
  textInputStyle: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  addTextBtn: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  }
});
