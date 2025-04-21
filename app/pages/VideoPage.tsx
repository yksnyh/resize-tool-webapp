import React, { useState, useEffect, useRef } from 'react';
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

const supportedExtensions: VideoExtensions[] = ['mp4', 'mov', 'webm'];
const defaultOutputExtension = 'mp4'; // 出力はMP4固定

export function VideoPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [width, setWidth] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [fps, setFps] = useState<number | ''>('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [progressLog, setProgressLog] = useState<string[]>([]); // 進捗メッセージを配列で管理
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressEndRef = useRef<HTMLDivElement>(null); // 進捗表示の末尾参照用

  // outputUrlが変更されたら、古いURLを解放する
  useEffect(() => {
    return () => {
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }
    };
  }, [outputUrl]);

  // 進捗ログが更新されたら、表示エリアの最下部にスクロールする
  useEffect(() => {
    progressEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progressLog]);

  // ファイル選択ハンドラ
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (fileExt && supportedExtensions.includes(fileExt as VideoExtensions)) {
        setSelectedFile(file);
        setOutputBlob(null);
        setOutputUrl(null);
        setError(null);
        setProgressLog([]); // 進捗ログリセット
      } else {
        setError(`Unsupported file type: .${fileExt}. Supported types: ${supportedExtensions.join(', ')}`);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = ''; // ファイル入力をリセット
        }
      }
    }
  };

  // 進捗メッセージを追加する関数
  const addProgress = (message: string) => {
    // FFmpegのログは詳細すぎる場合があるので、必要に応じてフィルタリングしても良い
    setProgressLog((prev) => [...prev, message]);
  };

  // 変換ボタンクリックハンドラ
  const handleResizeClick = async () => {
    if (!selectedFile) {
      setError('Please select a video file first.');
      return;
    }

    const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() as VideoExtensions;
    if (!fileExt || !supportedExtensions.includes(fileExt)) {
      setError(`Invalid file extension: ${fileExt}`);
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
    setError(null);
    setOutputBlob(null);
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl); // 古いURLを解放
      setOutputUrl(null);
    }
    setProgressLog(['Starting process...']); // 進捗ログ初期化

    try {
      // videoutils.ts の resizeVideo を呼び出し、進捗コールバックを渡す
      const resultBlob = await resizeVideo(
        selectedFile,
        targetWidth,
        targetHeight,
        targetFps,
        fileExt,
        addProgress // 進捗メッセージを受け取る関数
      );

      if (resultBlob) {
        setOutputBlob(resultBlob);
        const url = URL.createObjectURL(resultBlob);
        setOutputUrl(url);
        addProgress('Processing complete! Output video is ready.');
      } else {
        // resizeVideoがnullを返した場合 (エラーはコールバックで通知されているはず)
        setError('Video processing failed. Check progress log for details.');
        addProgress('Error: Processing failed.');
      }
    } catch (err: any) {
      // resizeVideo呼び出し自体で予期せぬエラーが発生した場合
      console.error('Error during resizeVideo call:', err);
      const errorMessage = `An unexpected error occurred: ${err.message || err}`;
      setError(errorMessage);
      addProgress(`Error: ${errorMessage}`);
    } finally {
      setIsProcessing(false); // 処理完了
    }
  };

  // ダウンロードハンドラ
  const handleDownload = () => {
    if (outputUrl && outputBlob) {
      const link = document.createElement('a');
      link.href = outputUrl;
      // 元のファイル名に基づいてダウンロードファイル名を生成
      const originalName = selectedFile?.name.split('.').slice(0, -1).join('.') || 'video';
      link.download = `${originalName}_resized.${defaultOutputExtension}`; // 出力拡張子を使用
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // accept属性を動的に生成
  const acceptTypes = supportedExtensions.map(ext => `video/${ext},.${ext}`).join(',');

  return (
    // Cardで全体をラップし、中央寄せと最大幅を設定
    <Card className="max-w-3xl mx-auto my-4">
      <CardHeader>
        <CardTitle>Resize Video</CardTitle>
        <CardDescription>
          Select a video file, specify desired dimensions (width/height) and/or FPS, then click "Resize Video".
        </CardDescription>
      </CardHeader>

      {/* フォーム要素や結果をCardContentに入れる */}
      <CardContent className="grid gap-6">
        {/* ファイル選択 */}
        <FormItem>
          <Label htmlFor="videoFile">Select Video File</Label>
          <Input
            ref={fileInputRef}
            type="file"
            id="videoFile"
            accept={acceptTypes}
            onChange={handleFileChange}
            disabled={isProcessing}
            className="w-full" // 幅を調整
          />
          {selectedFile && (
            <p className="text-sm text-muted-foreground mt-1">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
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
              className="w-full" // 幅を調整
            />
            {/* FormDescriptionの代わりにpタグを使用 */}
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
              className="w-full" // 幅を調整
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
              className="w-full" // 幅を調整
            />
             <p className="text-xs text-muted-foreground mt-1">Leave blank for original</p>
          </FormItem>
        </div>

        {/* リサイズボタン */}
        <Button
          onClick={handleResizeClick}
          disabled={isProcessing || !selectedFile}
          className="w-full sm:w-auto justify-self-start" // 左寄せに変更
        >
          {isProcessing ? 'Processing...' : 'Resize Video'}
        </Button>

        {/* エラー表示 */}
        {error && (
          // FormMessageの代わりにpタグを使用
          <p className="text-sm font-medium text-destructive">
            Error: {error}
          </p>
        )}

        {/* 進捗ログ */}
        {(isProcessing || progressLog.length > 1) && ( // 処理中またはログがある場合に表示
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Progress Log:</h3>
            {/* preタグにUIスタイルを適用 */}
            <pre className="max-h-60 overflow-y-auto rounded-md border bg-muted p-4 text-sm text-muted-foreground whitespace-pre-wrap break-words">
              {progressLog.join('\n')}
              <div ref={progressEndRef} /> {/* スクロール用 */}
            </pre>
          </div>
        )}

        {/* 結果表示 */}
        {outputUrl && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Result:</h3>
            <video
              controls
              src={outputUrl}
              // videoタグにUIスタイルを適用
              className="w-full max-w-full rounded-md border bg-muted"
              style={{ maxHeight: '400px' }} // 最大高さはインラインスタイルで維持
            />
            <div className="flex items-center gap-4">
              <Button onClick={handleDownload}>
                Download Resized Video
              </Button>
              {outputBlob && (
                <span className="text-sm text-muted-foreground">
                  Output size: {(outputBlob.size / 1024 / 1024).toFixed(2)} MB
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* CardFooter は今回は特に不要そう */}
      {/* <CardFooter>
        <p>Optional footer content</p>
      </CardFooter> */}
    </Card>
  );
}
