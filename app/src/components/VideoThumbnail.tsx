import { useState } from 'react';

export default function VideoThumbnail({ id }: { id?: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <div className="relative grid h-full w-full place-items-center overflow-hidden bg-slate-800 text-white">
    {id && failed !== id && <img key={id} src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover"
      onError={() => setFailed(id)} onLoad={event=>{if(event.currentTarget.naturalWidth<=120&&event.currentTarget.naturalHeight<=90)setFailed(id);}} />}
    <span className="material-symbols-outlined relative rounded-full bg-slate-900/80 p-1 text-3xl" aria-hidden>play_arrow</span>
  </div>;
}
