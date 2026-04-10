import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { TabGlyph } from '../components/TabGlyph';
import { ActivityScreen } from '../screens/ActivityScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { LogScreen } from '../screens/LogScreen';
import { NutriScreen } from '../screens/NutriScreen';
import { SymptomCheckerScreen } from '../screens/SymptomCheckerScreen';
import { colors } from '../theme/colors';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          height: 68,
          paddingTop: 8,
          paddingBottom: 8,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarIcon: ({ focused }) => {
          const glyphMap = {
            Dashboard: 'DB',
            Activity: 'AC',
            Log: 'LG',
            Insights: 'IN',
            Nutri: 'NU',
            SymptomChecker: 'SC',
          } as const;

          const glyphKey = route.name as keyof typeof glyphMap;
          return <TabGlyph active={focused} glyph={glyphMap[glyphKey]} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Log" component={LogScreen} options={{ title: 'Log' }} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Nutri" component={NutriScreen} />
      <Tab.Screen
        name="SymptomChecker"
        component={SymptomCheckerScreen}
        options={{ title: 'Checker' }}
      />
    </Tab.Navigator>
  );
}
