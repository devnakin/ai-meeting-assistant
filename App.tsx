import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { transcribeAudio, summarizeText } from './services/geminiService';
import { MicrophoneIcon, UploadIcon, StopCircleIcon, DocumentTextIcon, SparklesIcon, ClipboardIcon, ClipboardCheckIcon, ExclamationTriangleIcon, DownloadIcon } from './components/Icons';
import { Status, TranscriptSegment } from './types';

const formatTranscript = (segments: TranscriptSegment[], forFile: boolean = false): string => {
    const separator = forFile ? '\n' : '\n\n';
    return segments.map(segment => {
        const speakerLabel = segment.speaker ? `${segment.speaker}: ` : '';
        return `[${segment.startTime} - ${segment.endTime}] ${speakerLabel}${segment.text}`;
    }).join(separator);
};

const App: React.FC = () => {
    const [status, setStatus] = useState<Status>(Status.IDLE);
    const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
    const [summary, setSummary] = useState<string>('');
    const [error, setError] = useState<string>('');

    const [copiedTranscript, setCopiedTranscript] = useState(false);
    const [copiedSummary, setCopiedSummary] = useState(false);

    const { isRecording, startRecording, stopRecording, audioBlob } = useAudioRecorder();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = () => {
        setTranscript([]);
        setSummary('');
        setError('');
        setCopiedTranscript(false);
        setCopiedSummary(false);
        setStatus(Status.IDLE);
    };

    const handleProcessAudio = useCallback(async (blob: Blob) => {
        resetState();
        setStatus(Status.PROCESSING);
        
        try {
            const transcriptResult = await transcribeAudio(blob);
            setTranscript(transcriptResult);

            if (transcriptResult && transcriptResult.length > 0) {
                const summaryResult = await summarizeText(transcriptResult);
                setSummary(summaryResult);
            } else {
                setSummary("ไม่สามารถสร้างสรุปได้เนื่องจากไม่มีข้อความที่ถอดเสียง");
            }

            setStatus(Status.DONE);
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่รู้จัก';
            setError(`เกิดข้อผิดพลาดระหว่างการประมวลผล: ${errorMessage}`);
            setStatus(Status.IDLE);
        }
    }, []);

    useEffect(() => {
        if (audioBlob) {
            handleProcessAudio(audioBlob);
        }
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioBlob]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            handleProcessAudio(file);
        }
    };
    
    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const copyToClipboard = (content: TranscriptSegment[] | string, type: 'transcript' | 'summary') => {
        const textToCopy = type === 'transcript' && Array.isArray(content) ? formatTranscript(content) : content as string;
        navigator.clipboard.writeText(textToCopy);

        if (type === 'transcript') {
            setCopiedTranscript(true);
            setTimeout(() => setCopiedTranscript(false), 2000);
        } else {
            setCopiedSummary(true);
            setTimeout(() => setCopiedSummary(false), 2000);
        }
    };

    const handleExport = (content: TranscriptSegment[] | string, type: 'transcript' | 'summary') => {
        const filename = `${type}.txt`;
        const textToExport = type === 'transcript' && Array.isArray(content) ? formatTranscript(content, true) : content as string;
        const blob = new Blob([textToExport], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-slate-900 font-sans text-slate-200 flex flex-col items-center p-4 sm:p-6 md:p-8">
            <main className="w-full max-w-4xl flex flex-col gap-8">
                <Header />
                <ActionPanel 
                    isRecording={isRecording}
                    isLoading={status === Status.PROCESSING}
                    startRecording={startRecording}
                    stopRecording={stopRecording}
                    handleUploadClick={handleUploadClick}
                />
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="audio/*"
                />

                {status === Status.PROCESSING && <Loader />}
                
                {error && <ErrorDisplay message={error} />}

                {status === Status.DONE && transcript.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <ResultCard 
                            title="ข้อความที่ถอดเสียง" 
                            icon={<DocumentTextIcon />}
                            content={transcript}
                            onCopy={() => copyToClipboard(transcript, 'transcript')}
                            isCopied={copiedTranscript}
                            onExport={() => handleExport(transcript, 'transcript')}
                        />
                        <ResultCard
                            title="สรุปการประชุม"
                            icon={<SparklesIcon />}
                            content={summary}
                            onCopy={() => copyToClipboard(summary, 'summary')}
                            isCopied={copiedSummary}
                            onExport={() => handleExport(summary, 'summary')}
                        />
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
};

const Header: React.FC = () => (
    <header className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
            ผู้ช่วยประชุม AI
        </h1>
        <p className="mt-2 text-lg text-slate-400">
            บันทึก อัปโหลด และรับสรุปการประชุมของคุณในทันที
        </p>
    </header>
);

interface ActionPanelProps {
    isRecording: boolean;
    isLoading: boolean;
    startRecording: () => void;
    stopRecording: () => void;
    handleUploadClick: () => void;
}

const ActionPanel: React.FC<ActionPanelProps> = ({ isRecording, isLoading, startRecording, stopRecording, handleUploadClick }) => (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 shadow-lg flex flex-col sm:flex-row items-center justify-center gap-4">
        {isRecording ? (
            <button
                onClick={stopRecording}
                disabled={isLoading}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105 disabled:cursor-not-allowed"
            >
                <StopCircleIcon />
                หยุดการบันทึก
            </button>
        ) : (
            <button
                onClick={startRecording}
                disabled={isLoading}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-900 text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105 disabled:cursor-not-allowed"
            >
                <MicrophoneIcon />
                เริ่มบันทึกเสียง
            </button>
        )}
        <span className="text-slate-500 font-medium">หรือ</span>
        <button
            onClick={handleUploadClick}
            disabled={isLoading || isRecording}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-900 text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105 disabled:cursor-not-allowed"
        >
            <UploadIcon />
            อัปโหลดไฟล์เสียง
        </button>
    </div>
);


const Loader: React.FC = () => (
    <div className="flex flex-col items-center justify-center gap-4 text-slate-400 my-10">
        <div className="w-16 h-16 border-4 border-t-sky-400 border-slate-700 rounded-full animate-spin"></div>
        <p className="text-lg font-medium">กำลังประมวลผล โปรดรอสักครู่...</p>
        <p className="text-sm">AI กำลังถอดเสียงและสรุปให้คุณ</p>
    </div>
);

const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => (
    <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg flex items-center gap-3">
        <ExclamationTriangleIcon />
        <span className="font-medium">{message}</span>
    </div>
);

interface ResultCardProps {
    title: string;
    icon: React.ReactNode;
    content: string | TranscriptSegment[];
    onCopy: () => void;
    isCopied: boolean;
    onExport: () => void;
}

const ResultCard: React.FC<ResultCardProps> = ({ title, icon, content, onCopy, isCopied, onExport }) => (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 shadow-lg flex flex-col h-full">
        <div className="p-4 flex justify-between items-center border-b border-slate-700">
            <h2 className="text-xl font-bold flex items-center gap-2 text-sky-400">
                {icon}
                {title}
            </h2>
            <div className="flex items-center gap-2">
                 <button 
                    onClick={onExport} 
                    className="p-2 rounded-md hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-100"
                    aria-label='ส่งออก'
                >
                    <DownloadIcon />
                </button>
                <button 
                    onClick={onCopy} 
                    className="p-2 rounded-md hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-100 relative"
                    aria-label={isCopied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                >
                    {isCopied ? <ClipboardCheckIcon /> : <ClipboardIcon />}
                </button>
            </div>
        </div>
        <div 
            className="p-6 prose prose-invert prose-p:text-slate-300 prose-ul:text-slate-300 prose-li:marker:text-sky-400 overflow-y-auto flex-grow"
            style={{ maxHeight: '50vh' }}
        >
           {Array.isArray(content) ? (
                <div className="flex flex-col gap-4">
                    {content.map((segment, index) => (
                        <div key={index}>
                            <p className="font-mono text-xs text-sky-300/80 m-0">{`[${segment.startTime} - ${segment.endTime}]`}</p>
                            <p className="mt-1 text-base text-slate-200">
                                {segment.speaker && <strong className="text-emerald-400">{segment.speaker}: </strong>}
                                {segment.text}
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="whitespace-pre-wrap">{content}</div>
            )}
        </div>
    </div>
);

const Footer: React.FC = () => (
    <footer className="w-full max-w-4xl text-center text-slate-500 mt-12 py-4 border-t border-slate-800">
        <p>ขับเคลื่อนโดย Gemini API & React. สร้างสรรค์ด้วยความรัก 💌</p>
    </footer>
);

export default App;
