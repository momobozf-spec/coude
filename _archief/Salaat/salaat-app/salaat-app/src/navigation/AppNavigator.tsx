import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { HomeScreen } from '../screens/HomeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

export type RootStackParams = {
  Home: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParams>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerShown: false, animationEnabled: true }}
      >
        <Stack.Screen name="Home"     component={HomeScreen}     />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{
          presentation: 'modal',
          cardStyleInterpolator: ({ current, layouts }) => ({
            cardStyle: {
              transform: [{
                translateY: current.progress.interpolate({
                  inputRange:  [0, 1],
                  outputRange: [layouts.screen.height, 0],
                }),
              }],
            },
          }),
        }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
