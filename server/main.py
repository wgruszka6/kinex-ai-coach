import React, { useState, useEffect, useRef } from 'react'
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native'
import { mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCView } from 'react-native-webrtc'
import io from 'socket.io-client'
import Svg, { Circle, Line } from 'react-native-svg'
import * as Speech from 'expo-speech'

const SERVER_URL = 'https://7be1-185-28-19-74.ngrok-free.app'

const VIDEO_WIDTH = 480
const VIDEO_HEIGHT = 640
const VIDEO_ASPECT_RATIO = VIDEO_WIDTH / VIDEO_HEIGHT

const BONES = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24],
    [23, 25], [25, 27], [24, 26], [26, 28],
]

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
                const rawStart = landmarks[s]
                const rawEnd = landmarks[e]
                if (rawStart?.v > 0.5 && rawEnd?.v > 0.5) {
                    const start = mapPoint(rawStart.x, rawStart.y)
                    const end = mapPoint(rawEnd.x, rawEnd.y)
                    return (
                        <Line key={`b-${i}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke='#39FF14' strokeWidth='3' />
                    )
                }
                return null
            })}
            {landmarks.map((lm, i) => {
                if (lm?.v > 0.5 && i > 10) {
                    const point = mapPoint(lm.x, lm.y)
                    return <Circle key={`j-${i}`} cx={point.x} cy={point.y} r='5' fill='white' />
                }
                return null
            })}
        </Svg>
    )
}

export default function CameraScreen({ route, navigation }) {
    const { exerciseName } = route.params || {}
    const { pose } = route.params || {}
    const [localStream, setLocalStream] = useState(null)
    const [landmarks, setLandmarks] = useState([])
    const [status, setStatus] = useState('READY')
    const [isReceiving, setIsReceiving] = useState(false)
    const [layoutDims, setLayoutDims] = useState({ width: 0, height: 0 })
    const [feedback, setFeedback] = useState('')

    const socketRef = useRef(null)
    const pcRef = useRef(null)
    const streamRef = useRef(null)
    const receiveTimeoutRef = useRef(null)
    const feedbackTimerRef = useRef(null)

    useEffect(() => {
        socketRef.current = io(SERVER_URL)

        socketRef.current.on('connect', () => setStatus('CONNECTED'))

        socketRef.current.on('pose_data', data => {
            if (data?.landmarks) setLandmarks(data.landmarks)
            setIsReceiving(true)
            if (receiveTimeoutRef.current) clearTimeout(receiveTimeoutRef.current)
            receiveTimeoutRef.current = setTimeout(() => setIsReceiving(false), 300)
        })

        socketRef.current.on('Gemini_feedback', data => {
            const messageText = typeof data === 'string' ? data : data.message || data.text || ''

            if (messageText) {
                setFeedback(messageText)
                if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
                feedbackTimerRef.current = setTimeout(() => setFeedback(''), 5000)

                Speech.stop()
                Speech.speak(messageText, {
                    language: 'en-US', // 👈 Zmienione na angielski
                    pitch: 1.0,
                    rate: 0.9,
                })
            }
        })

        socketRef.current.on('webrtc_answer', async answer => {
            if (pcRef.current) {
                await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer))
            }
        })

        return () => {
            if (receiveTimeoutRef.current) clearTimeout(receiveTimeoutRef.current)
            if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
            streamRef.current?.getTracks().forEach(track => track.stop())
            pcRef.current?.close()
            socketRef.current?.disconnect()
            Speech.stop()
        }
    }, [])

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

            const offer = await pcRef.current.createOffer({})
            await pcRef.current.setLocalDescription(offer)
            socketRef.current.emit('set_target_pose', { pose: exerciseName || 'Unknown' })
            socketRef.current.emit('webrtc_offer', { type: offer.type, sdp: offer.sdp })
        } catch (e) {
            console.error(e)
            setStatus('CONNECTION ERROR')
        }
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{pose}</Text>
                <View style={styles.statusBadge}>
                    <View style={[styles.dot, { backgroundColor: isReceiving ? '#39FF14' : 'red' }]} />
                    <Text style={styles.statusText}>{isReceiving ? 'AI LIVE' : status}</Text>
                </View>
            </View>

            {localStream ? (
                <View
                    style={styles.videoContainer}
                    onLayout={e => setLayoutDims({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
                    <RTCView streamURL={localStream.toURL()} style={styles.video} objectFit='cover' mirror={true} />
                    <SkeletonOverlay landmarks={landmarks} layoutDims={layoutDims} />

                    {feedback !== '' && (
                        <View style={styles.feedbackContainer}>
                            <Text style={styles.feedbackText}>{feedback}</Text>
                        </View>
                    )}
                </View>
            ) : (
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
    title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    statusText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    videoContainer: { flex: 1 },
    video: { ...StyleSheet.absoluteFillObject },
    feedbackContainer: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        backgroundColor: '#210B64',
        padding: 20,
        borderRadius: 15,
        zIndex: 999,
    },
    feedbackText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
    button: {
        backgroundColor: '#210B64',
        paddingHorizontal: 50,
        paddingVertical: 20,
        borderRadius: 50,
        alignSelf: 'center',
        marginTop: 'auto',
        marginBottom: 100,
    },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
})