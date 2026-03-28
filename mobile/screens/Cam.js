import React, { useState, useEffect, useRef } from 'react'
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native'
import { mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCView } from 'react-native-webrtc'
import io from 'socket.io-client'
import Svg, { Circle, Line } from 'react-native-svg'

// ⚠️ TWÓJ NGROK DO SERWERA PYTHON
const SERVER_URL = 'https://7be1-185-28-19-74.ngrok-free.app'

const VIDEO_WIDTH = 480
const VIDEO_HEIGHT = 640
const VIDEO_ASPECT_RATIO = VIDEO_WIDTH / VIDEO_HEIGHT

const BONES = [
	[11, 12],
	[11, 13],
	[13, 15],
	[12, 14],
	[14, 16],
	[11, 23],
	[12, 24],
	[23, 24],
	[23, 25],
	[25, 27],
	[24, 26],
	[26, 28],
]

// ==========================================
// KOMPONENT NAKŁADKI SZKIELETU
// ==========================================
const SkeletonOverlay = ({ landmarks, layoutDims }) => {
	if (!landmarks || landmarks.length === 0 || layoutDims.width === 0) return null
	const { width: s_width, height: s_height } = layoutDims
	const scaledWidth = s_height * VIDEO_ASPECT_RATIO
	const x_offset = (scaledWidth - s_width) / 2

	const mapPoint = (rawX, rawY) => {
		const mirroredX = 1.0 - rawX
		return {
			x: mirroredX * scaledWidth - x_offset,
			y: rawY * s_height,
		}
	}

	return (
		<Svg style={StyleSheet.absoluteFillObject}>
			{BONES.map(([s, e], i) => {
				const rawStart = landmarks[s],
					rawEnd = landmarks[e]
				if (rawStart && rawEnd && rawStart.v > 0.5 && rawEnd.v > 0.5) {
					const start = mapPoint(rawStart.x, rawStart.y),
						end = mapPoint(rawEnd.x, rawEnd.y)
					return (
						<Line key={`b-${i}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke='#39FF14' strokeWidth='3' />
					)
				}
				return null
			})}
			{landmarks.map((lm, i) => {
				// Ukrywamy twarz (i > 10)
				if (lm && lm.v > 0.5 && i > 10) {
					const point = mapPoint(lm.x, lm.y)
					return <Circle key={`j-${i}`} cx={point.x} cy={point.y} r='5' fill='white' />
				}
				return null
			})}
		</Svg>
	)
}

// ==========================================
// GŁÓWNY EKRAN KAMERY
// ==========================================
export default function CameraScreen({ route, navigation }) {
	const { pose } = route.params || {}
	const{exerciseName} = route.params || {};

	// Stany
	const [localStream, setLocalStream] = useState(null)
	const [landmarks, setLandmarks] = useState([])
	const [status, setStatus] = useState('READY!')
	const [isReceiving, setIsReceiving] = useState(false)
	const [layoutDims, setLayoutDims] = useState({ width: 0, height: 0 })
	const [feedback, setFeedback] = useState('')

	// Refy
	const socketRef = useRef(null)
	const pcRef = useRef(null)
	const streamRef = useRef(null)
	const receiveTimeoutRef = useRef(null)
	const feedbackTimerRef = useRef(null) // Ref na timer komunikatów

	useEffect(() => {
		socketRef.current = io(SERVER_URL)

		socketRef.current.on('connect', () => setStatus('Połączono z serwerem'))
		socketRef.current.on('disconnect', () => setStatus('Rozłączono z serwerem'))

		// Odbieranie współrzędnych AI
		socketRef.current.on('pose_data', data => {
			if (data?.landmarks) setLandmarks(data.landmarks)
			setIsReceiving(true)
			if (receiveTimeoutRef.current) clearTimeout(receiveTimeoutRef.current)
			receiveTimeoutRef.current = setTimeout(() => setIsReceiving(false), 300)
		})

		// 👈 POPRAWIONE ODBIERANIE KOMUNIKATÓW Gemini_feedback
		socketRef.current.on('Gemini_feedback', data => {
			console.log('📥 Otrzymano feedback z serwera:', data) // Sprawdź terminal Metro!

			// Wyciągamy tekst (niezależnie czy to string czy obiekt JSON)
			const messageText = typeof data === 'string' ? data : data.message || data.text || data.feedback || ''

			if (messageText) {
				// 1. Ustawiamy tekst na ekranie
				setFeedback(messageText)

				// 2. Czyścimy poprzedni timer (jeśli AI wysłało korektę bardzo szybko)
				if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)

				// 3. Ustawiamy nowy timer na 5 sekund
				feedbackTimerRef.current = setTimeout(() => {
					setFeedback('')
				}, 5000)
			}
		})

		// Odbieranie sygnału WebRTC
		socketRef.current.on('webrtc_answer', async answer => {
			setStatus('WebRTC LIVE! WAITING FOR AI FEEDBACK...')
			if (pcRef.current) {
				await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer))
			}
		})

		// Czyszczenie przy wyjściu z ekranu
		return () => {
			if (receiveTimeoutRef.current) clearTimeout(receiveTimeoutRef.current)
			if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
			streamRef.current?.getTracks().forEach(track => track.stop())
			pcRef.current?.close()
			socketRef.current?.disconnect()
		}
	}, [])

	// Funkcja startująca kamerę i połączenie
	const startYoga = async () => {
		setStatus('STARTING CAMERA...')
		try {
			const stream = await mediaDevices.getUserMedia({
				audio: false,
				video: { facingMode: 'front', width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
			})
			setLocalStream(stream)
			streamRef.current = stream

			pcRef.current = new RTCPeerConnection({
				iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
			})

			stream.getTracks().forEach(track => pcRef.current.addTrack(track, stream))

			setStatus('Zestawiam połączenie...')
			const offer = await pcRef.current.createOffer({})
			await pcRef.current.setLocalDescription(offer)

			// Wysyłamy ofertę do Pythona
			socketRef.current.emit('set_target_pose', { pose: exerciseName || 'Unknown' })

			socketRef.current.emit('webrtc_offer', { type: offer.type, sdp: offer.sdp })
		} catch (e) {
			console.error(e)
			setStatus('CONNECTION ERROR')
		}
	}

	return (
		<View style={styles.container}>
			{/* NAGŁÓWEK I STATUS */}
			<View style={styles.header}>
				<Text style={styles.title}>{pose}</Text>
				<View style={styles.statusBadge}>
					<View style={[styles.dot, { backgroundColor: isReceiving ? '#39FF14' : 'red' }]} />
					<Text style={styles.statusText}>{isReceiving ? 'AI LIVE' : status}</Text>
				</View>
			</View>

			{localStream ? (
				// KONTENER WIDEO I NAKŁADEK
				<View
					style={styles.videoContainer}
					onLayout={e => setLayoutDims({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
					<RTCView streamURL={localStream.toURL()} style={styles.video} objectFit='cover' mirror={true} />

					{/* Nakładka szkieletu */}
					<SkeletonOverlay landmarks={landmarks} layoutDims={layoutDims} />

					{/* 👈 WYŚWIETLANIE KOMUNIKATU AI NA SAMYM WIERZCHU */}
					{feedback !== '' && (
						<View style={styles.feedbackContainer}>
							<Text style={styles.feedbackText}>{feedback}</Text>
						</View>
					)}
				</View>
			) : (
				// PRZYCISK START
				<TouchableOpacity style={styles.button} onPress={startYoga}>
					<Text style={styles.buttonText}>START SESSION</Text>
				</TouchableOpacity>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#000' },
	header: { position: 'absolute', top: 60, left: 20, right: 20, zIndex: 10, alignItems: 'center' },
	title: {
		color: '#fff',
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 5,
		textShadowColor: 'rgba(0,0,0,0.8)',
		textShadowOffset: { width: 1, height: 1 },
		textShadowRadius: 3,
	},

	statusBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(0,0,0,0.7)',
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 20,
	},
	dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
	statusText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

	videoContainer: { flex: 1, position: 'relative' },
	video: { ...StyleSheet.absoluteFillObject },

	// 👈 POPRAWIONE STYLE DLA KOMUNIKATU AI
	feedbackContainer: {
		position: 'absolute',
		bottom: 80, // Podniesione wyżej, żeby było widoczne
		left: 20,
		right: 20,
		backgroundColor: '#210B64', // Prawie pełny neonowy zielony
		padding: 20,
		borderRadius: 15,
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 999, // Na samym wierzchu
		elevation: 5, // Dla Androida
	},
	feedbackText: {
		color: '#FFF', // Czarny tekst na zielonym tle
		fontSize: 25,
		fontWeight: '900',
		textAlign: 'center',
	},

	button: {
		backgroundColor: '#210B64',
		paddingHorizontal: 50,
		paddingVertical: 20,
		borderRadius: 50,
		alignSelf: 'center',
		marginTop: 'auto',
		marginBottom: 100,
	},
	buttonText: { fontWeight: 'bold', color: '#FFF', fontSize: 20 },
})
