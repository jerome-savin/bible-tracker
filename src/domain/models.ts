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
export interface ReadingPreferences {
 activePlan?:'canonical';
 lastPassage?:{bookId:number; chapter:number; verse?:number};
}
export interface BackupDocument {
 format:'bible-tracker-backup'; version:2; exportedAt:string;
 reference:'bkuhl-2cbb2c0e2a00db458bf3af8636a725a65c8cc3fe';
 state:ReadingState; preferences:ReadingPreferences;
}
export interface BackupPreview {
 backup:BackupDocument; source:'phase-1'|'version-2'; warnings:string[];
 summary:{userId:string; demo:boolean; events:number; readings:number; rereadings:number; corrections:number; verses:number};
}
export interface RecoveryBackup {id:string; createdAt:string; reason:'migration'|'restauration'|'nouveau-carnet'; backup:BackupDocument}
export interface ReadingRepository {
 load():Promise<ReadingState|null>;
 /** Adaptateur pour l'écran existant ; n'écrit que les événements ajoutés. */
 save(state:ReadingState):Promise<ReadingState>;
 appendEvents(userId:string,events:ReadingEvent[]):Promise<ReadingState>;
 readEvents(userId:string):Promise<ReadingEvent[]>;
 reconstructProgress(userId:string):Promise<Record<string,number[]>>;
 loadPreferences():Promise<ReadingPreferences>;
 savePreferences(preferences:ReadingPreferences):Promise<void>;
 exportBackup(fallback?:ReadingState):Promise<BackupDocument>;
 previewImport(json:string):BackupPreview;
 restore(backup:BackupDocument,options:{confirmed:boolean; expectedState:ReadingState|null}):Promise<{state:ReadingState; recovery:RecoveryBackup|null}>;
 listRecoveries():Promise<RecoveryBackup[]>;
}
export interface ReadingPlan { id:string; name:string; status:'available'|'planned'; steps:{id:string; passages:Passage[]}[]; }
