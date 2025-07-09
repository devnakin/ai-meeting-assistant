
import { useState, useRef, useCallback } from 'react';

export const useAudioRecorder = () => {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setIsRecording(true);
            setAudioBlob(null);
            audioChunksRef.current = [];
            
            const options = { mimeType: 'audio/webm' };
            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.addEventListener("dataavailable", (event) => {
                if (typeof event.data === "undefined") return;
                if (event.data.size === 0) return;
                audioChunksRef.current.push(event.data);
            });

            mediaRecorder.addEventListener("stop", () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                // Stop all tracks on the stream to release the microphone
                stream.getTracks().forEach(track => track.stop());
            });

            mediaRecorder.start();
        } catch (err) {
            console.error("Failed to get user media", err);
            alert("ไม่สามารถเข้าถึงไมโครโฟนได้ โปรดตรวจสอบการอนุญาตในเบราว์เซอร์ของคุณ");
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, []);

    return { isRecording, startRecording, stopRecording, audioBlob };
};
