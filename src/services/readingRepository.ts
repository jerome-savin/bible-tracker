import type {ReadingRepository} from '../domain/models';
import {IndexedDBReadingRepository} from './repository';

/** Point de composition unique ; les composants utilisent seulement le contrat métier. */
export const readingRepository:ReadingRepository=new IndexedDBReadingRepository();
