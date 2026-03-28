import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ImageBackground, SafeAreaView, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

export default function MainScreen({ navigation }) {
    return (
        <ImageBackground source={require('../assets/main.png')} style={styles.background} resizeMode='cover'>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.contentContainer}>
                    <View style={styles.leftColumn}>
                        {['K', 'I', 'N', 'E', 'X'].map((letter, index) => (
                            <Text key={index} style={styles.logoLetter}>
                                {letter}
                            </Text>
                        ))}
                    </View>
                    <View style={styles.rightColumn}>
                        <Text style={styles.sloganText}>
                            Real-time feedback.{'\n'}Real-world results.{'\n'}Meet your new pocket{'\n'}personal trainer.
                        </Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.buttonWrapper} onPress={() => navigation.navigate('Poses')} activeOpacity={0.7}>
                    <BlurView intensity={40} tint='light' style={styles.glassButton}>
                        <Text style={styles.buttonText}>Start Training</Text>
                    </BlurView>
                </TouchableOpacity>
            </SafeAreaView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background: { flex: 1, width: '100%', height: '100%' },
    safeArea: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 30, paddingVertical: 40 },
    contentContainer: { flexDirection: 'row', marginTop: 40, flex: 1 },
    leftColumn: { marginRight: 40, justifyContent: 'flex-start', marginLeft: 20, fontSize: 65 },
    logoLetter: {
        fontSize: width * 0.2,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: height * 0.01,
        fontFamily: 'KinexLogo',
    },
    rightColumn: { flex: 1, justifyContent: 'right', paddingTop: height * 0.05 },

    iconPlaceholder: { marginBottom: 15 },

    sloganText: {
        color: 'white',
        fontSize: width * 0.05,
        lineHeight: width * 0.06,
        fontWeight: '500',
        fontFamily: 'Subtext',
        paddingTop: height * 0.4,
        paddingRight: width * 0.05,
        alignItems: 'flex-end',
        textAlign: 'right',
    },

    buttonWrapper: {
        alignSelf: 'center',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: height * 0.1,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        width: '60%',
    },
    glassButton: {
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    buttonText: { color: 'white', fontSize: 22, fontWeight: '400', letterSpacing: 1 },
});