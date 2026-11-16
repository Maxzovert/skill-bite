import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppLogo } from "./AppLogo";
import { colors, font, radii, space } from "../theme";

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  plain?: boolean;
};

export function AuthShell({ eyebrow, title, subtitle, children, footer, plain = false }: Props) {
  const insets = useSafeAreaInsets();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [enter]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.orbTeal} />
      <View style={styles.orbBlue} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            plain ? styles.contentPlain : null,
            { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              plain ? styles.plainStack : null,
              {
                opacity: enter,
                transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
              },
            ]}
          >
            <View style={[styles.hero, plain ? styles.heroPlain : null]}>
              <AppLogo size={plain ? 120 : 88} />
              <Text style={[styles.brand, plain ? styles.brandPlain : null]}>SkillBite</Text>
              <Text style={[styles.eyebrow, plain ? styles.centeredText : null]}>{eyebrow}</Text>
              <Text style={[styles.title, plain ? styles.centeredText : null]}>{title}</Text>
              <Text style={[styles.subtitle, plain ? styles.centeredText : null]}>{subtitle}</Text>
            </View>

            <View style={[styles.card, plain ? styles.cardPlain : null]}>{children}</View>

            <View style={[styles.footer, plain ? styles.footerPlain : null]}>{footer}</View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: space.lg,
    gap: space.xl,
  },
  contentPlain: {
    flexGrow: 1,
    justifyContent: "center",
  },
  plainStack: {
    gap: space.xl,
  },
  orbTeal: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(242,131,175,0.45)",
    top: -40,
    right: -70,
  },
  orbBlue: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(243,204,151,0.85)",
    bottom: "12%",
    left: -80,
  },
  hero: {
    alignItems: "flex-start",
    gap: space.sm,
    marginBottom: space.sm,
  },
  heroPlain: {
    alignItems: "center",
  },
  brand: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: font.display,
    letterSpacing: 0.4,
  },
  brandPlain: {
    fontSize: 36,
    lineHeight: 42,
    textAlign: "center",
  },
  centeredText: {
    textAlign: "center",
    alignSelf: "stretch",
  },
  eyebrow: {
    marginTop: space.md,
    color: colors.accent,
    fontSize: 13,
    fontFamily: font.medium, fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    lineHeight: 42,
    fontFamily: font.display,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: colors.inkMuted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: font.body,
    maxWidth: 320,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: space.sm,
    gap: space.lg,
  },
  cardPlain: {
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
    gap: space.lg,
  },
  footer: {
    alignItems: "center",
    gap: space.md,
  },
  footerPlain: {
    marginTop: space.md,
  },
});
