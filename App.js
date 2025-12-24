import React, { useState, useEffect, useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';
import { getScriptUrl } from './src/utils/storage';
import { AuthProvider, AuthContext } from './src/context/AuthContext';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import ManualScreen from './src/screens/ManualScreen';
import BulkScreen from './src/screens/BulkScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import GlobalHistoryScreen from './src/screens/GlobalHistoryScreen'; // Nuevo
import LoginScreen from './src/screens/LoginScreen';

const Stack = createStackNavigator();

const AppContent = () => {
    const { user } = useContext(AuthContext);
    const [initialRoute, setInitialRoute] = useState(null);

    useEffect(() => {
        checkConfiguration();
    }, []);

    const checkConfiguration = async () => {
        try {
            const url = await getScriptUrl();
            // Si tenemos URL, verificamos auth. 
            // Si no, forzamos Configuración (que es accesible vía enlace Configuración en Login de todos modos, 
            // pero mantengamos la lógica simple: Si no hay usuario, mostrar Login).
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
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!user ? (
                    // Pila de Autenticación
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Settings" component={SettingsScreen} />
                    </>
                ) : (
                    // Pila de Aplicación
                    <>
                        <Stack.Screen name="Home" component={HomeScreen} />
                        <Stack.Screen name="Settings" component={SettingsScreen} />
                        <Stack.Screen name="Scanner" component={ScannerScreen} />
                        <Stack.Screen name="Manual" component={ManualScreen} />
                        <Stack.Screen name="Bulk" component={BulkScreen} />
                        <Stack.Screen name="History" component={HistoryScreen} />
                        <Stack.Screen name="GlobalHistory" component={GlobalHistoryScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}
