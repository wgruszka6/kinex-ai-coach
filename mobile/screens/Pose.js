import React from 'react'
import {
	StyleSheet,
	View,
	Text,
	TouchableOpacity,
	ImageBackground,
	SafeAreaView,
	FlatList,
	Dimensions,
	Image,
} from 'react-native'
import { BlurView } from 'expo-blur'

const { width, height } = Dimensions.get('window')
const MARGIN_SIDE = width * 0.06
const GAP_MIDDLE = width * 0.04

const CARD_WIDTH = (width - 2 * MARGIN_SIDE - GAP_MIDDLE) / 2

const EXERCISES = [
	{ id: 'plank', name: 'PLANK', subtext: 'PLANK' },
	{ id: 'warriorII', name: 'WARRIOR II', subtext: 'WARRIOR II' },
	{ id: 'Empty', name: '' },
	{ id: 'Empty', name: '' },
	{ id: 'Empty', name: '' },
	{ id: 'Empty', name: '' },
]

export default function PoseScreen({ navigation }) {
	const renderPoseCard = ({ item }) => (
		<TouchableOpacity
			style={styles.cardWrapper}
			activeOpacity={0.7}
			onPress={() => navigation.navigate('Camera', { exerciseName: item.name, Pose: item.subtext })}>
			<BlurView intensity={30} tint='light' style={styles.glassCard}>
				<Image source={item.icon} style={styles.cardIcon} />
				<Text style={styles.cardText}>{item.subtext}</Text>
			</BlurView>
		</TouchableOpacity>
	)

	return (
		<ImageBackground source={require('../assets/pose.png')} style={styles.background} resizeMode='cover'>
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.headerContainer}>
					<Text style={styles.titleBold}>Pick</Text>
					<Text style={styles.titleLight}>a Pose</Text>
				</View>
				<FlatList
					data={EXERCISES}
					renderItem={renderPoseCard}
					keyExtractor={item => item.id}
					numColumns={2}
					contentContainerStyle={{
						paddingHorizontal: width * 0.06,
						paddingBottom: 40,
					}}
					columnWrapperStyle={{
						gap: width * 0.04,
						marginBottom: width * 0.04,
					}}
					showsVerticalScrollIndicator={false}
				/>
			</SafeAreaView>
		</ImageBackground>
	)
}

const styles = StyleSheet.create({
	background: { flex: 1, width: '100%', height: '100%' },

	safeArea: {
		flex: 1,
		paddingHorizontal: MARGIN_SIDE,
		paddingTop: height * 0.05,
	},

	headerContainer: {
		marginBottom: height * 0.04,
		paddingHorizontal: 5,
	},
	titleBold: {
		fontSize: width * 0.13,
		fontWeight: 'bold',
		color: 'white',
		fontFamily: 'KinexLogo',
	},
	titleLight: {
		fontSize: width * 0.11,
		color: 'white',
		marginLeft: width * 0.08,
		marginTop: -height * 0.01,
		fontFamily: 'KinexLogo',
	},

	gridContainer: {
		paddingBottom: 40,
	},
	rowWrapper: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: GAP_MIDDLE,
	},

	cardWrapper: {
		flex: 1,
		aspectRatio: 1,
		borderRadius: 20,
		overflow: 'hidden',
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.2)',
	},

	glassCard: {
		flex: 1,
		backgroundColor: 'rgba(255, 255, 255, 0.08)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 10,
	},

	cardIcon: {
		width: width * 0.12,
		height: width * 0.12,
		resizeMode: 'contain',
		marginBottom: 12,
	},
	cardText: {
		color: 'white',
		fontSize: width * 0.05,
		fontFamily: 'MainText',
	},
	cardSubText: {
		color: 'rgba(255, 255, 255, 0.6)',
		fontSize: width * 0.03,
		fontFamily: 'SubText',
		marginTop: 4,
	},
})
