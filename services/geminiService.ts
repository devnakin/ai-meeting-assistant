import { GoogleGenAI, Type } from "@google/genai";
import { TranscriptSegment } from "../types";

if (!process.env.API_KEY) {
    throw new Error("Missing API_KEY environment variable");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const transcriptionModel = 'gemini-2.5-flash';
const summarizationModel = 'gemini-2.5-flash';

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const transcriptSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            speaker: {
                type: Type.STRING,
                description: "The identified speaker, e.g., 'ผู้พูด 1', 'ผู้พูด 2'. If speaker cannot be identified, leave it empty.",
            },
            text: {
                type: Type.STRING,
                description: 'The transcribed text for this segment.',
            },
            startTime: {
                type: Type.STRING,
                description: 'The start time of the segment in HH:MM:SS format.',
            },
            endTime: {
                type: Type.STRING,
                description: 'The end time of the segment in HH:MM:SS format.',
            },
        },
        required: ["text", "startTime", "endTime"],
    },
};

export const transcribeAudio = async (audioBlob: Blob): Promise<TranscriptSegment[]> => {
    try {
        const base64Audio = await blobToBase64(audioBlob);
        
        const audioPart = {
            inlineData: {
                mimeType: audioBlob.type,
                data: base64Audio,
            },
        };

        const textPart = {
            text: "โปรดถอดเสียงไฟล์เสียงนี้เป็นข้อความแบบเต็มพร้อมระบุช่วงเวลาเริ่มต้นและสิ้นสุดของแต่ละประโยคหรือส่วนของคำพูดที่สำคัญ และระบุผู้พูดถ้าทำได้ (เช่น 'ผู้พูด 1', 'ผู้พูด 2') จัดรูปแบบผลลัพธ์เป็น JSON ตาม Schema ที่ให้มา",
        };

        const response = await ai.models.generateContent({
            model: transcriptionModel,
            contents: { parts: [textPart, audioPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: transcriptSchema,
            },
        });
        
        const jsonResponse = JSON.parse(response.text);
        return jsonResponse as TranscriptSegment[];

    } catch (error) {
        console.error("Error transcribing audio:", error);
        throw new Error("ไม่สามารถถอดเสียงได้ อาจเกิดจากไฟล์เสียงไม่ชัดเจนหรือมีข้อผิดพลาดในการเชื่อมต่อ โปรดลองอีกครั้ง");
    }
};


export const summarizeText = async (transcript: TranscriptSegment[]): Promise<string> => {
    if (!transcript || transcript.length === 0) {
        return "ไม่มีข้อความให้สรุป";
    }
    
    const textToSummarize = transcript.map(segment => segment.text).join('\n');

    try {
        const prompt = `
        คุณคือผู้ช่วยประชุมมืออาชีพ หน้าที่ของคุณคือการสรุปข้อความที่ถอดเสียงจากการประชุม
        โปรดอ่านข้อความต่อไปนี้และสรุปเป็นประเด็นสำคัญ (key takeaways) ในรูปแบบ bullet points ที่ชัดเจนและกระชับเป็นภาษาไทย

        ข้อความที่จะสรุป:
        ---
        ${textToSummarize}
        ---

        กรุณาสร้างสรุปการประชุม:
        `;

        const response = await ai.models.generateContent({
            model: summarizationModel,
            contents: prompt,
             config: {
                temperature: 0.3,
            }
        });

        return response.text;
    } catch (error) {
        console.error("Error summarizing text:", error);
        throw new Error("ไม่สามารถสร้างสรุปได้ โปรดลองอีกครั้ง");
    }
};
