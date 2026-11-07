import { useCallback, useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Animated, StyleSheet, View } from 'react-native';
import { setUiLanguage, useUiLanguage } from './lib/i18n';
import { loadDeviceLanguage } from './lib/i18n/deviceLanguage';
import { configureNotificationHandler } from './lib/push/push';
import { SessionProvider } from './lib/session/SessionProvider';
import { loadSettings } from './lib/settings';
import { navigationRef } from './navigation/navigationRef';
import { navigationState } from './navigation/navigationState';
import RootNavigator from './navigation/RootNavigator';
import theme, { fontsToLoad } from './theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotificationHandler();

/** The app's root: loads the fonts, the saved language and settings, then draws the signed-in or signed-out screens under the navigation. */
export default function App() {
  const [fontsReady, setFontsReady] = useState(false);
  const language = useUiLanguage();
  // The language the screens are drawn in. It trails a change by a short fade, so the screens never jump to the new words.
  const [shown, setShown] = useState(language);
  const cover = useRef(new Animated.Value(0)).current;
  const firstShown = useRef(true);

  useEffect(() => {
    if (language === shown) return;
    if (!fontsReady) {
      setShown(language);
      return;
    }
    Animated.timing(cover, { toValue: 1, duration: theme.motion.fast, useNativeDriver: true }).start(
      ({ finished }) => finished && setShown(language),
    );
  }, [language, shown, fontsReady, cover]);

  // Once the screens are drawn afresh in the new language, the cover fades away to show them.
  useEffect(() => {
    if (firstShown.current) {
      firstShown.current = false;
      return;
    }
    Animated.timing(cover, {
      toValue: 0,
      duration: theme.motion.settle,
      delay: 60,
      easing: theme.easing.out,
      useNativeDriver: true,
    }).start();
  }, [shown, cover]);

  useEffect(() => {
    const fonts = Font.loadAsync(fontsToLoad).catch((error) => console.warn('Failed to load fonts', error));
    const deviceLanguage = loadDeviceLanguage().then(setUiLanguage);
    Promise.all([fonts, deviceLanguage, loadSettings()]).finally(() => setFontsReady(true));
  }, []);

  const saved = navigationState.get();
  const openScreens = saved ? { initialState: saved } : {};

  const onLayoutRootView = useCallback(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: theme.color.background }} />;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <SessionProvider>
        {/* A new language draws every screen afresh, back on the screens that were open. */}
        <NavigationContainer
          key={shown}
          ref={navigationRef}
          {...openScreens}
          onStateChange={navigationState.set}
          theme={{
            dark: false,
            colors: {
              primary: theme.color.primary,
              background: theme.color.background,
              card: theme.color.background,
              text: theme.color.textPrimary,
              border: theme.color.border,
              notification: theme.color.alert.fg,
            },
            // React Navigation's type asks for a weight too; the family already carries it.
            fonts: {
              regular: { fontFamily: theme.font.regular, fontWeight: '400' },
              medium: { fontFamily: theme.font.medium, fontWeight: '500' },
              bold: { fontFamily: theme.font.semiBold, fontWeight: '600' },
              heavy: { fontFamily: theme.font.bold, fontWeight: '700' },
            },
          }}
        >
          <RootNavigator />
        </NavigationContainer>
      </SessionProvider>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cover, { opacity: cover }]} />

      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ cover: { backgroundColor: theme.color.background } });
