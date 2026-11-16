import { Image, StyleSheet, View } from "react-native";

type Props = {
  size?: number;
};

export function AppLogo({ size = 96 }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image
        source={require("../../assets/App_Logo.png")}
        style={styles.image}
        resizeMode="contain"
        accessibilityLabel="SkillBite"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
});
