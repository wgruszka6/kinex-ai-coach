import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';

import MainScreen from './screens/Main';
import PoseScreen from './screens/Pose';
import CamScreen from './screens/Cam';

const Stack = createNativeStackNavigator();

export default function App() {
    const [fontsLoaded] = useFonts({
        KinexLogo: require('./assets/Kalnia/static/KalniaMedium.ttf'),
        Subtext: require('./assets/Kumbh_Sans/Kumbh.ttf'),
        Maintext: require('./assets/Newsreader/news.ttf'),
    });

    if (!fontsLoaded) {
        return (
            <View style={{ flex: 1, backgroundColor: '#1a0b2e', justifyContent: 'center' }}>
                <ActivityIndicator size='large' color='#ffffff' />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name='Home' component={MainScreen} />
                <Stack.Screen name='Poses' component={PoseScreen} />
                <Stack.Screen name='Camera' component={CamScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}