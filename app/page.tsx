import Image from 'next/image';
import PipeGame from '@/components/pipegame';

export default function Home() {
  return (
    <div className="bg-black items-center justify-center flex min-h-screen">
      <PipeGame sizeX={3} sizeY={3} />
    </div>
  );
}
