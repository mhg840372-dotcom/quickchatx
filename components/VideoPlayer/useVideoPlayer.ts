import { useRef, useState, useEffect, useCallback } from "react";
import { Animated, Platform, PanResponder } from "react-native";

export function useVideoPlayer({ sources, autoPlay = true, loop = true }) {
  /* ===============================
       ESTADOS PRINCIPALES
  =============================== */
  const [currentSource, setCurrentSource] = useState(sources[0]);
  const [playing, setPlaying] = useState(autoPlay);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [qualityMenu, setQualityMenu] = useState(false);

  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [ended, setEnded] = useState(false);
  const [speed, setSpeed] = useState(1);

  /* ===============================
       REFERENCIAS
  =============================== */
  const videoRef = useRef(null);
  const fsRef = useRef(null);
  const hideTimer = useRef(null);

  const fade = useRef(new Animated.Value(0)).current;
  const heart = useRef(new Animated.Value(0)).current;

  const seekWidth = useRef(0);
  const lastTap = useRef(0);

  const FFAnim = useRef(new Animated.Value(0)).current;
  const RWAnim = useRef(new Animated.Value(0)).current;

  /* ===============================
        AUTO-HIDE CONTROLS
  =============================== */
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);

    hideTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 2500);
  }, []);

  /* ===============================
        FADE AL CARGAR
  =============================== */
  useEffect(() => {
    if (ready) {
      Animated.timing(fade, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [ready]);

  /* ===============================
        DOUBLE TAP - LIKE
  =============================== */
  const triggerLike = () => {
    heart.setValue(0);

    Animated.spring(heart, { toValue: 1, useNativeDriver: true }).start(() => {
      Animated.timing(heart, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start();
    });
  };

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      triggerLike();
    } else {
      setPlaying((p) => !p);
      showControlsTemporarily();
    }
    lastTap.current = now;
  };

  /* ===============================
        LOAD & PROGRESS
  =============================== */
  const onLoad = (data) => {
    setDuration(data.duration);
    setReady(true);
    setEnded(false);
  };

  const onProgress = (data) => {
    setPosition(data.currentTime);
    if (data.currentTime >= duration - 0.3) setEnded(true);
  };

  const onBuffer = ({ isBuffering }) => setBuffering(isBuffering);

  /* ===============================
        SEEK
  =============================== */
  const handleSeek = (evt, ref) => {
    const x = evt.nativeEvent.locationX;
    if (!seekWidth.current || !duration) return;

    const ratio = Math.max(0, Math.min(1, x / seekWidth.current));
    const newPos = ratio * duration;

    ref.current?.seek(newPos);
    setPosition(newPos);
    setEnded(false);
  };

  /* ===============================
        FULLSCREEN
  =============================== */
  const openFS = () => {
    setFullscreen(true);
    setPlaying(false);
    setTimeout(() => fsRef.current?.seek(position), 150);
  };

  const closeFS = () => {
    setFullscreen(false);
    setTimeout(() => {
      videoRef.current?.seek(position);
      setPlaying(true);
    }, 150);
  };

  /* ===============================
        CAMBIO DE CALIDAD
  =============================== */
  const changeQuality = (s) => {
    setCurrentSource(s);

    setTimeout(() => {
      videoRef.current?.seek(position);
      fsRef.current?.seek(position);
    }, 200);
  };

  /* ===============================
        VELOCIDAD
  =============================== */
  const cycleSpeed = () => {
    const all = [0.5, 1, 1.5, 2];
    const next = all[(all.indexOf(speed) + 1) % all.length];
    setSpeed(next);
  };

  /* ===============================
        REPLAY
  =============================== */
  const replay = () => {
    videoRef.current?.seek(0);
    fsRef.current?.seek(0);
    setEnded(false);
    setPlaying(true);
  };

  /* ===============================
        SWIPE GESTURES
  =============================== */
  const animateFF = () => {
    Animated.sequence([
      Animated.timing(FFAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(FFAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const animateRW = () => {
    Animated.sequence([
      Animated.timing(RWAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(RWAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20,
    onPanResponderRelease: (_, g) => {
      if (g.dx > 45) {
        const newPos = Math.min(duration, position + 10);
        fsRef.current?.seek(newPos);
        videoRef.current?.seek(newPos);
        setPosition(newPos);
        animateFF();
      } else if (g.dx < -45) {
        const newPos = Math.max(0, position - 10);
        fsRef.current?.seek(newPos);
        videoRef.current?.seek(newPos);
        setPosition(newPos);
        animateRW();
      }
    },
  });

  /* ===============================
        PICTURE IN PICTURE
  =============================== */
  const enterPIP = () => {
    if (Platform.OS === "android") {
      try {
        videoRef.current?.presentPictureInPicture();
      } catch {}
    }
  };

  return {
    /* Refs */
    videoRef,
    fsRef,
    fade,
    heart,
    FFAnim,
    RWAnim,

    /* states */
    playing,
    muted,
    ready,
    duration,
    position,
    buffering,
    ended,
    speed,
    fullscreen,
    qualityMenu,
    currentSource,
    showControls,

    /* setters */
    setPlaying,
    setMuted,
    setQualityMenu,
    setShowControls,

    /* actions */
    enterPIP,
    onLoad,
    onProgress,
    onBuffer,
    handleSeek,
    onTap,
    changeQuality,
    cycleSpeed,
    replay,
    openFS,
    closeFS,

    /* gestures */
    panResponder,

    /* constants */
    seekWidth,
    loop,
    sources,
  };
}
