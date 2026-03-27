import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import TilePreview2D from './TilePreview2D';
import SpherePreview3D from './SpherePreview3D';
import type { PatternEngine } from '@/engine/PatternEngine';

interface PreviewContainerProps {
  engine: PatternEngine | null;
  renderVersion: number;
}

export default function PreviewContainer({ engine, renderVersion }: PreviewContainerProps) {
  const [tab, setTab] = useState('2d');

  return (
    <Tabs value={tab} onValueChange={setTab} className="flex flex-col w-full h-full gap-0">
      <div className="shrink-0 flex justify-center py-2">
        <TabsList className="h-7">
          <TabsTrigger value="2d" className="text-xs px-3 py-0.5">2D Tile</TabsTrigger>
          <TabsTrigger value="3d" className="text-xs px-3 py-0.5">3D Sphere</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="2d" className="flex-1 min-h-0">
        <TilePreview2D engine={engine} renderVersion={renderVersion} />
      </TabsContent>
      <TabsContent value="3d" className="flex-1 min-h-0">
        <SpherePreview3D engine={engine} renderVersion={renderVersion} />
      </TabsContent>
    </Tabs>
  );
}
