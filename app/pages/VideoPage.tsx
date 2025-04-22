import React, { useState, useEffect, useRef, useCallback } from 'react';
import { resizeVideo } from '../lib/videoutils'; // videoutilsからresizeVideo関数をインポート
import type { VideoExtensions } from "../commons/fileconst";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
// FormItem は react-hook-form なしでもレイアウトに使える
import { FormItem } from "~/components/ui/form"; // FormItemのみインポート
import { Progress } from "~/components/ui/progress"; // 進捗バーを追加 (任意)
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"; // アラート表示用
import { XCircle } from "lucide-react"; // エラーアイコン用

const supportedExtensions: VideoExtensions[] = ['mp4', 'mov', 'webm'];
const defaultOutputExtension = 'mp4';
const MAX_FILES = 3; // 最大ファイル数

// 各ファイルの処理結果を管理するインターフェース
interface ProcessingResult {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  outputBlob?: Blob;
  outputUrl?: string;
  progressLog: string[];
  error?: string;
  progressPercent?: number; // 進捗率 (任意)
}

export function VideoPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [width, setWidth] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [fps, setFps] = useState<number | ''>('');
  const [results, setResults] = useState<ProcessingResult[]>([]); // ファイルごとの結果を管理
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null); // グローバルなエラー（ファイル選択、パラメータ等）
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressEndRefs = useRef<(HTMLDivElement | null)[]>([]); // 各ログエリアの末尾参照用

  // resultsが変更されたら、不要になった古いURLを解放する
  useEffect(() => {
    const urlsToRevoke = results
      .filter(r => r.outputUrl)
      .map(r => r.outputUrl as string);

    return () => {
      urlsToRevoke.forEach(url => URL.revokeObjectURL(url));
      // コンポーネントアンマウント時に現在のresultsにあるURLも解放
      results.forEach(r => {
        if (r.outputUrl) {
          URL.revokeObjectURL(r.outputUrl);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]); // resultsの変更を監視

  // 進捗ログが更新されたら、該当する表示エリアの最下部にスクロールする
  useEffect(() => {
    results.forEach((result, index) => {
      if (result.status === 'processing' || result.status === 'success' || result.status === 'error') {
        progressEndRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    });
  }, [results]); // resultsの変更（特にprogressLogの更新）を監視

  // ファイル選択ハンドラ
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles: File[] = [];
      const fileErrors: string[] = [];
      let acceptedCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (acceptedCount >= MAX_FILES) {
          fileErrors.push(`You can only select up to ${MAX_FILES} files. File "${file.name}" was ignored.`);
          continue; // 最大数を超えたらスキップ
        }

        const fileExt = file.name.split('.').pop()?.toLowerCase();
        if (fileExt && supportedExtensions.includes(fileExt as VideoExtensions)) {
          newFiles.push(file);
          acceptedCount++;
        } else {
          fileErrors.push(`Unsupported file type: "${file.name}". Supported types: ${supportedExtensions.join(', ')}`);
        }
      }

      setSelectedFiles(newFiles);
      setResults([]); // ファイル選択が変わったら結果をリセット
      setError(fileErrors.length > 0 ? fileErrors.join('\n') : null); // ファイル選択時のエラーを表示

      // ファイル入力自体をリセットしないと、同じファイルを選択し直せない
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 特定のファイルの進捗メッセージを追加/更新する関数
  const updateProgress = useCallback((fileIndex: number, message: string, percent?: number) => {
    setResults(prevResults => {
      const newResults = [...prevResults];
      if (newResults[fileIndex]) {
        // FFmpegのログは非常に多いので、最新の数件のみ保持するなどしても良い
        newResults[fileIndex] = {
          ...newResults[fileIndex],
          progressLog: [...newResults[fileIndex].progressLog, message],
          progressPercent: percent !== undefined ? percent : newResults[fileIndex].progressPercent, // 進捗率を更新
        };
      }
      return newResults;
    });
  }, []);

  // 変換ボタンクリックハンドラ
  const handleResizeClick = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one video file.');
      return;
    }

    const targetWidth = width === '' ? null : Number(width);
    const targetHeight = height === '' ? null : Number(height);
    const targetFps = fps === '' ? null : Number(fps);

    // 幅、高さ、FPSのいずれも指定されていない場合はエラー
    if (targetWidth === null && targetHeight === null && targetFps === null) {
      setError('Please specify at least one parameter: width, height, or FPS.');
      return;
    }
    // 不正な値（0以下）が入力された場合はエラー
    if ((targetWidth !== null && targetWidth <= 0) || (targetHeight !== null && targetHeight <= 0) || (targetFps !== null && targetFps <= 0)) {
      setError('Width, height, and FPS must be positive numbers.');
      return;
    }

    setIsProcessing(true);
    setError(null); // グローバルエラーをクリア

    // 処理対象ファイルの初期状態を設定
    const initialResults: ProcessingResult[] = selectedFiles.map(file => ({
      file,
      status: 'pending',
      progressLog: [],
      progressPercent: 0,
    }));
    setResults(initialResults);
    progressEndRefs.current = initialResults.map(() => null); // ref配列を初期化

    // 各ファイルを順次処理 (並列処理する場合は Promise.all などを使用)
    // ここでは順次処理の例
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileExt = file.name.split('.').pop()?.toLowerCase() as VideoExtensions;

      // 結果オブジェクトを 'processing' に更新
      setResults(prev => {
        const newResults = [...prev];
        newResults[i] = { ...newResults[i], status: 'processing', progressLog: ['Starting process...'] };
        return newResults;
      });

      try {
        // videoutils.ts の resizeVideo を呼び出し、進捗コールバックを渡す
        const resultBlob = await resizeVideo(
          file,
          targetWidth,
          targetHeight,
          targetFps,
          fileExt,
          (message, percent) => updateProgress(i, message, percent) // 進捗メッセージとパーセントを受け取る
        );

        if (resultBlob) {
          const url = URL.createObjectURL(resultBlob);
          setResults(prev => {
            const newResults = [...prev];
            newResults[i] = {
              ...newResults[i],
              status: 'success',
              outputBlob: resultBlob,
              outputUrl: url,
              progressLog: [...newResults[i].progressLog, 'Processing complete! Output video is ready.'],
              progressPercent: 100,
            };
            return newResults;
          });
        } else {
          // resizeVideoがnullを返した場合 (エラーはコールバックで通知されているはず)
          setResults(prev => {
            const newResults = [...prev];
            const errorMessage = 'Video processing failed. Check progress log for details.';
            newResults[i] = {
              ...newResults[i],
              status: 'error',
              error: errorMessage,
              progressLog: [...newResults[i].progressLog, `Error: ${errorMessage}`],
            };
            return newResults;
          });
        }
      } catch (err: any) {
        // resizeVideo呼び出し自体で予期せぬエラーが発生した場合
        console.error(`Error processing file ${file.name}:`, err);
        const errorMessage = `An unexpected error occurred: ${err.message || err}`;
        setResults(prev => {
          const newResults = [...prev];
          newResults[i] = {
            ...newResults[i],
            status: 'error',
            error: errorMessage,
            progressLog: [...newResults[i].progressLog, `Error: ${errorMessage}`],
          };
          return newResults;
        });
      }
    }

    setIsProcessing(false); // 全ての処理完了
  };

  // ダウンロードハンドラ
  const handleDownload = (url: string | undefined, blob: Blob | undefined, originalFileName: string) => {
    if (url && blob) {
      const link = document.createElement('a');
      link.href = url;
      const baseName = originalFileName.split('.').slice(0, -1).join('.') || 'video';
      link.download = `${baseName}_resized.${defaultOutputExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // accept属性を動的に生成
  const acceptTypes = supportedExtensions.map(ext => `video/${ext},.${ext}`).join(',');

  return (
    <Card className="max-w-4xl mx-auto my-4"> {/* 最大幅を少し広げる */}
      <CardHeader>
        <CardTitle>Resize Multiple Videos</CardTitle>
        <CardDescription>
          Select up to {MAX_FILES} video files, specify desired dimensions (width/height) and/or FPS, then click "Resize Videos".
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-6">
        {/* ファイル選択 */}
        <FormItem>
          <Label htmlFor="videoFiles">Select Video Files (Max {MAX_FILES})</Label>
          <Input
            ref={fileInputRef}
            type="file"
            id="videoFiles"
            accept={acceptTypes}
            onChange={handleFileChange}
            disabled={isProcessing}
            multiple // 複数ファイル選択を許可
            className="w-full"
          />
          {selectedFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-sm font-medium">Selected Files:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                {selectedFiles.map((file, index) => (
                  <li key={index}>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</li>
                ))}
              </ul>
            </div>
          )}
        </FormItem>

        {/* サイズとFPSの入力フィールド */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormItem>
            <Label htmlFor="width">Width (px)</Label>
            <Input
              type="number"
              id="width"
              value={width}
              onChange={(e) => setWidth(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              placeholder="Auto"
              min="1"
              disabled={isProcessing}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">Leave blank for auto</p>
          </FormItem>

          <FormItem>
            <Label htmlFor="height">Height (px)</Label>
            <Input
              type="number"
              id="height"
              value={height}
              onChange={(e) => setHeight(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              placeholder="Auto"
              min="1"
              disabled={isProcessing}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">Leave blank for auto</p>
          </FormItem>

          <FormItem>
            <Label htmlFor="fps">FPS</Label>
            <Input
              type="number"
              id="fps"
              value={fps}
              onChange={(e) => setFps(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              placeholder="Original"
              min="1"
              disabled={isProcessing}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">Leave blank for original</p>
          </FormItem>
        </div>

        {/* リサイズボタン */}
        <Button
          onClick={handleResizeClick}
          disabled={isProcessing || selectedFiles.length === 0}
          className="w-full sm:w-auto justify-self-start"
        >
          {isProcessing ? 'Processing...' : `Resize ${selectedFiles.length > 0 ? selectedFiles.length : ''} Video(s)`}
        </Button>

        {/* グローバルエラー表示 */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error.split('\n').map((line, i) => <p key={i}>{line}</p>)}
            </AlertDescription>
          </Alert>
        )}

        {/* 結果表示エリア */}
        {results.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold border-b pb-2">Processing Results:</h3>
            {results.map((result, index) => (
              <Card key={index} className="overflow-hidden"> {/* 各結果をカードで囲む */}
                <CardHeader className="bg-muted/50 p-4">
                  <CardTitle className="text-base">
                    File: {result.file.name}
                    {result.status === 'processing' && <span className="ml-2 text-sm font-normal text-primary animate-pulse"> (Processing...)</span>}
                    {result.status === 'success' && <span className="ml-2 text-sm font-normal text-green-600"> (Completed)</span>}
                    {result.status === 'error' && <span className="ml-2 text-sm font-normal text-destructive"> (Failed)</span>}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Original size: {(result.file.size / 1024 / 1024).toFixed(2)} MB
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 grid gap-4">
                  {/* 進捗バー (任意) */}
                  {(result.status === 'processing' || result.status === 'success') && result.progressPercent !== undefined && (
                    <Progress value={result.progressPercent} className="w-full h-2" />
                  )}

                  {/* 進捗ログ */}
                  {(result.status !== 'pending' && result.progressLog.length > 0) && (
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Progress Log:</Label>
                      <pre className="max-h-40 overflow-y-auto rounded-md border bg-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                        {result.progressLog.join('\n')}
                        <div ref={el => { progressEndRefs.current[index] = el }} /> {/* スクロール用 */}
                      </pre>
                    </div>
                  )}

                  {/* エラー表示 */}
                  {result.status === 'error' && result.error && (
                    <Alert variant="destructive" className="mt-2">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>Processing Error</AlertTitle>
                      <AlertDescription className="text-xs">
                        {result.error}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* 成功時の結果表示 */}
                  {result.status === 'success' && result.outputUrl && (
                    <div className="space-y-3">
                      <Label className="text-xs font-semibold">Result:</Label>
                      <video
                        controls
                        src={result.outputUrl}
                        className="w-full max-w-sm rounded-md border bg-muted mx-auto" // 中央寄せ、最大幅設定
                        style={{ maxHeight: '300px' }}
                      />
                      <div className="flex items-center gap-4 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => handleDownload(result.outputUrl, result.outputBlob, result.file.name)}
                        >
                          Download Resized Video
                        </Button>
                        {result.outputBlob && (
                          <span className="text-sm text-muted-foreground">
                            Output size: {(result.outputBlob.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
