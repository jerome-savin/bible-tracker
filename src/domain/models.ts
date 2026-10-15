export interface Book { id:number; name:string; chapters:number[] }
export interface Passage { bookId:number; chapter:number; verses:number[] }
export interface ReadingEvent extends Passage { id:string; userId:string; occurredAt:string; kind:'lecture'|'correction'; }
export interface ReadingState { schemaVersion:1; userId:string; demo:boolean; progress:Record<string,number[]>; events:ReadingEvent[]; }
export interface ReadingRepository { load():Promise<ReadingState|null>; save(state:ReadingState):Promise<void>; }
export interface ReadingPlan { id:string; name:string; status:'available'|'planned'; steps:{id:string; passages:Passage[]}[]; }
