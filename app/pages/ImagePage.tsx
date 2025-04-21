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

export function ImagePage() {
  return (
    // Cardで全体をラップし、中央寄せと最大幅を設定
    <Card className="max-w-3xl mx-auto my-4">
      <CardHeader>
        <CardTitle>Resize Image</CardTitle>
        <CardDescription>
          {/* Select a image file, specify desired dimensions (width/height), then click "Resize Image". */}
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-6">
        Under Constraction...
      </CardContent>
    </Card>
  );
}
