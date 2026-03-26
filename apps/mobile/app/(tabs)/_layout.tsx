import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";

type TabIconProps = {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
};

function TabIcon({ name, label, focused }: TabIconProps) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons
        name={name}
        size={20}
        color={focused ? colors.primary : colors.textSecondary}
        style={focused ? styles.iconGlow : undefined}
      />
      <Text
        style={[
          styles.label,
          { color: focused ? colors.primary : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
      {focused && <View style={styles.activeDot} />}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        animation: "fade",
        freezeOnBlur: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="home" label="HQ" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="engines"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="flash" label="Engines" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="checkbox" label="Track" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="hub"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="grid" label="Hub" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person" label="Profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.tabBar,
    borderTopColor: colors.tabBarBorder,
    borderTopWidth: 1,
    height: 72,
    paddingBottom: 8,
    paddingTop: 8,
    elevation: 0,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  iconGlow: {
    textShadowColor: colors.primary,
    textShadowRadius: 8,
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
});
