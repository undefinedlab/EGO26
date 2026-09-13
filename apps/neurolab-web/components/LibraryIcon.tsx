import type {CSSProperties} from "react";
const paths:Record<string,string>={
  search:"M21 21l-5-5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0",
  block:"m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8m-9 5v9",
  stack:"m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 17l9 5 9-5",
  source:"M4 7c0-5 16-5 16 0s-16 5-16 0Zm0 0v10c0 5 16 5 16 0V7M4 12c0 5 16 5 16 0",
  dataset:"M4 6c0 2.2 3.6 4 8 4s8-1.8 8-4-3.6-4-8-4-8 1.8-8 4Zm0 0v6c0 2.2 3.6 4 8 4s8-1.8 8-4V6M4 12v6c0 2.2 3.6 4 8 4s8-1.8 8-4v-6",
  brain:"M9.5 4.5A3.5 3.5 0 0 0 6 8v1.2A3.2 3.2 0 0 0 5 15.5V17a3 3 0 0 0 3 3h1.5M14.5 4.5A3.5 3.5 0 0 1 18 8v1.2a3.2 3.2 0 0 1 1 6.3V17a3 3 0 0 1-3 3h-1.5M9 8.5h6M9 12h6M10.5 16h3",
  region:"M12 21s7-4.8 7-11a7 7 0 1 0-14 0c0 6.2 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  circuit:"M5 5h5v5H5V5Zm9 0h5v5h-5V5ZM5 14h5v5H5v-5Zm14 2.5h-5V14M10 7.5h4M7.5 10v4",
  motif:"M5 5h6v6H5V5Zm13 3.5a2.5 2.5 0 1 1 0 .01M7.5 18.5a2.5 2.5 0 1 1 0 .01M11 8h5M8 11v5M9.5 18l8.5-7",
  arrow:"M5 12h14m-6-6 6 6-6 6",
  upload:"M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
  file:"M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8m-8 4h8",
  save:"M6 3h12v19l-6-4-6 4V3Z",
  fork:"M6 3v10a5 5 0 0 0 5 5h1M18 3v4a5 5 0 0 1-5 5H6M12 18v4",
  grid:"M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
  list:"M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1",
  check:"m5 12 4 4L19 6",
  close:"m6 6 12 12M6 18 18 6",
  clock:"M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  code:"m8 5-7 7 7 7m8-14 7 7-7 7m-3-16-2 18",
  people:"M16 21v-3c0-4-14-4-14 0v3m18 0v-3c0-2-2-3-4-3M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0m4-4a4 4 0 0 1 0 8"
};
export function kindIconName(kind:string){
  if(kind==="NeuroStack")return "stack";
  if(kind==="NeuroBlock")return "block";
  if(kind==="Dataset")return "dataset";
  if(kind==="Brain")return "brain";
  if(kind==="Region")return "region";
  if(kind==="Circuit")return "circuit";
  if(kind==="Motif")return "motif";
  return "source";
}
export function LibraryIcon({name,size=18,style}:{name:string;size?:number;style?:CSSProperties}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]??paths.block}/></svg>;}
