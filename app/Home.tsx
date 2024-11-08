'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { useRef, useState, useEffect } from 'react'
import { CircleHelpIcon, DownloadCloudIcon, DownloadIcon, Loader2Icon, PauseIcon, PlayIcon } from 'lucide-react'

export default function Home() {
  const [loaded, setLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [ffmpegArgs, setFfmpegArgs] = useState('-c:v libx264 -preset medium -crf 23')
  const [bitrate, setBitrate] = useState('1M')
  const [resolution, setResolution] = useState('1280x720')
  const ffmpegRef = useRef(new FFmpeg())
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const messageRef = useRef<HTMLParagraphElement | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        if (!loaded) {
          await load()
        }
      } catch (error) {
        console.error('Error loading FFmpeg:', error)
        setLogs(prev => [...prev, `Error loading FFmpeg: ${error}`])
      }
    }
    loadFFmpeg()
  }, [loaded])

  const load = async () => {
    setIsLoading(true)
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
    const ffmpeg = ffmpegRef.current
    ffmpeg.on('log', ({ message }) => {
      setLogs(prev => [...prev, message])
    })
    ffmpeg.on('progress', ({ progress, time }) => {
      setProgress(progress * 100)
      if (messageRef.current) {
        const timeLeft = (time / progress - time) / 1000000
        messageRef.current.innerHTML = `${Math.round(progress * 100)}% (estimated time left: ${timeLeft.toFixed(1)}s)`
      }
    })
    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
      })
      setLoaded(true)
      setLogs(prev => [...prev, 'FFmpeg loaded successfully'])
    } catch (error) {
      console.error('Error loading FFmpeg:', error)
      setLogs(prev => [...prev, `Error loading FFmpeg: ${error}`])
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setProgress(0)
      setLogs([])
    }
  }

  const clearAll = () => {
    setSelectedFile(null)
    setProgress(0)
    setLogs([])
    setBitrate('1M')
    setResolution('1280x720')
    setFfmpegArgs('-c:v libx264 -preset medium -crf 23')
    if(messageRef.current) {
      messageRef.current.innerHTML = ''
    }
    if (inputRef.current) {
      inputRef.current.value = ''
    }
    if (videoRef.current) {
      videoRef.current.src = ''
    }
  }

  const abortConversion = async () => {
    if (isConverting) {
      try {
        await ffmpegRef.current.terminate()
        setIsConverting(false)
        setProgress(0)
        setLogs(prev => [...prev, 'Conversion aborted by user'])
      } catch (error) {
        console.error('Error aborting conversion:', error)
      }
    }
  }

  const transcode = async () => {
    if (!selectedFile) {
      alert('Please select a file first')
      return
    }

    if (!loaded) {
      alert('FFmpeg is not loaded yet. Please wait...')
      return
    }

    setIsConverting(true)
    setAutoScroll(true)
    try {
      const ffmpeg = ffmpegRef.current
      const ext = selectedFile.name.split('.').pop() || 'avi'
      await ffmpeg.writeFile(`input.${ext}`, await fetchFile(selectedFile))
      
      // Build ffmpeg command from inputs
      const args = [
        '-i', `input.${ext}`,
        '-b:v', `${bitrate}`,
        '-s', resolution,
        ...ffmpegArgs.split(' '),
        'output.mp4'
      ]
      
      await ffmpeg.exec(args)
      const data = (await ffmpeg.readFile('output.mp4')) as any
      if (videoRef.current)
        videoRef.current.src = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }))
    } catch (err) {
      console.error('Conversion error:', err)
      if(String(err).includes('ffmpeg is not loaded, call `await ffmpeg.load()` first') ) {
        setLoaded(false)
      }
      setLogs(prev => [...prev, `Error: ${err}`])
    } finally {
      setIsConverting(false)
    }
  }

  const downloadVideo = () => {
    if (videoRef.current?.src) {
      const a = document.createElement('a')
      a.href = videoRef.current.src
      a.download = 'converted-video.mp4'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  return loaded ? (
    <div className="flex min-h-screen">
      {/* Left Side - Controls */}
      <div className="w-1/2 space-y-4 my-2 mx-2 px-2">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Input Video File</label>
            <CircleHelpIcon className="w-4 h-4 text-gray-500" aria-label="Select a video file to convert" />
          </div>
          <input 
            type="file" 
            accept="video/*"
            onChange={handleFileChange}
            className="w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Video Bitrate</label>
            <CircleHelpIcon className="w-4 h-4 text-gray-500" aria-label="Set video bitrate (e.g. 1M, 2M)" />
          </div>
          <input
            type="text"
            value={bitrate}
            onChange={(e) => setBitrate(e.target.value)}
            className="w-full p-2 border rounded-lg"
            placeholder="e.g. 1M"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Resolution</label>
            <CircleHelpIcon className="w-4 h-4 text-gray-500" aria-label="Set output resolution (e.g. 1280x720)" />
          </div>
          <input
            type="text"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="w-full p-2 border rounded-lg"
            placeholder="e.g. 1280x720"
            ref={inputRef}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">FFmpeg Arguments</label>
            <CircleHelpIcon className="w-4 h-4 text-gray-500" aria-label="Additional FFmpeg arguments" />
          </div>
          <textarea
            value={ffmpegArgs}
            onChange={(e) => setFfmpegArgs(e.target.value)}
            className="w-full h-32 p-2 border rounded-lg resize-none font-mono"
            placeholder="Enter additional FFmpeg arguments..."
          />
        </div>

        {progress > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={transcode}
            disabled={!selectedFile || isConverting}
            className="flex-1 bg-green-500 hover:bg-green-700 text-white py-3 px-6 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConverting ? 'Converting...' : 'Convert'}
          </button>

          <button
            onClick={abortConversion}
            disabled={!isConverting}
            className="bg-red-500 hover:bg-red-700 text-white py-3 px-6 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Abort
          </button>

          <button
            onClick={clearAll}
            className="bg-gray-500 hover:bg-gray-700 text-white py-3 px-6 rounded"
          >
            Clear
          </button>
        </div>
        
        <p ref={messageRef} className="text-sm text-gray-600"></p>
      </div>

      {/* Right Side - Video Output & Terminal */}
      <div className="w-1/2 flex flex-col gap-8 mx-2 mt-2">
        {/* Video Output */}
        <div className="bg-gray-100 p-4 rounded-lg">
          <video ref={videoRef} controls className="w-full rounded-lg"></video>
          {videoRef.current?.src && (
            <button
              onClick={downloadVideo}
              className="mt-4 bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded w-full flex items-center gap-2 justify-center"
            >
              <DownloadIcon className="size-3 mr-2" />
              Download Converted Video
            </button>
          )}
        </div>
        <div className='-mt-2'>
          {/* Terminal Logs */}
          <div 
            ref={logsContainerRef}
            className="bg-black rounded-lg flex-1 overflow-y-auto font-mono text-xs p-4 max-h-[calc(100vh-500px)] min-h-[calc(100vh-500px)]"
          >
            {logs.map((log, index) => (
              <div key={index} className="text-green-400">$ {log}</div>
            ))}
            <div ref={logsEndRef} />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className="mt-2 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded px-3 py-1.5 max-w-[220px]"
            >
              {autoScroll ? (
                <PauseIcon className="w-4 h-4" />
              ) : (
                <PlayIcon className="w-4 h-4" />
              )}
              Auto-scroll {autoScroll ? 'On' : 'Off'}
            </button>
        </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] flex items-center">
      <span className="animate-spin mr-3">
        <Loader2Icon className="size-4" />
      </span>
      <span>
        Loading ffmpeg-core... <span className="text-gray-500 opacity-0 animate-[fadeIn_3s_ease-in-out_forwards]">This may take a while...</span>
      </span>
    </div>
  )
}
