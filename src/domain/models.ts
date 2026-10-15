export interface Book { id:number; name:string; chapters:number[] }
export interface Passage { bookId:number; chapter:number; verses:number[] }
export interface ReadingEvent extends Passage {
 id:string; userId:string; occurredAt:string; kind:'lecture'|'relecture'|'correction';
 /** Absence = ancien événement phase 1, conservé sans réécriture. */
 modelVersion?:2;
 cancellations?:{eventId:string; verses:number[]}[];
 baselineVerses?:number[];
}
export interface ReadingState {
 schemaVersion:1; userId:string; demo:boolean; progress:Record<string,number[]>; events:ReadingEvent[];
 /** Instantané hérité immuable à l'adoption de la sémantique v2 ; migration physique au lot B. */
 legacyContext?:{progress:Record<string,number[]>};
}
export interface ReadingRepository { load():Promise<ReadingState|null>; save(state:ReadingState):Promise<void>; }
export interface ReadingPlan { id:string; name:string; status:'available'|'planned'; steps:{id:string; passages:Passage[]}[]; }
