import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';
import { getScriptUrl } from './src/utils/storage';


// Screens
import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import ManualScreen from './src/screens/ManualScreen';
import BulkScreen from './src/screens/BulkScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const Stack = createStackNavigator();

export default function App() {
    const [initialRoute, setInitialRoute] = useState(null);

    useEffect(() => {
        checkConfiguration();
    }, []);

    const checkConfiguration = async () => {
        try {
            const url = await getScriptUrl();
            if (url) {
                setInitialRoute('Home');
            } else {
                setInitialRoute('Settings');
            }
        } catch (e) {
            setInitialRoute('Settings');
        }
    };

    if (!initialRoute) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen 
                    name="Settings" 
                    component={SettingsScreen} 
                    initialParams={{ isInitial: initialRoute === 'Settings' }}
                />
                
                <Stack.Screen name="Scanner" component={ScannerScreen} />
                <Stack.Screen name="Manual" component={ManualScreen} />
                <Stack.Screen name="Bulk" component={BulkScreen} />
                <Stack.Screen name="History" component={HistoryScreen} />
                
            </Stack.Navigator>
        </NavigationContainer>
    );
}
