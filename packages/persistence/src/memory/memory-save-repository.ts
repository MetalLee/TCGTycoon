import type { SaveEnvelope,SaveId,SaveMetadata } from "@tcgtycoon/domain";
import type { SaveRepository } from "../contracts/save-repository";
import { migrateSave } from "../migrations/migrate-save";
import { canonicalStringify } from "../serialization/canonical-json";
export class MemorySaveRepository implements SaveRepository { private readonly saves=new Map<SaveId,string>(); async list():Promise<SaveMetadata[]>{return[...this.saves.values()].map(s=>{const{state,...m}=this.deserialize(s);void state;return m;});} async load(id:SaveId):Promise<SaveEnvelope>{const s=this.saves.get(id);if(s===undefined)throw new Error(`Save not found: ${id}`);return this.deserialize(s);} async save(save:SaveEnvelope):Promise<void>{this.saves.set(save.saveId,canonicalStringify(save));} async delete(id:SaveId):Promise<void>{this.saves.delete(id);} private deserialize(s:string):SaveEnvelope{return migrateSave(JSON.parse(s));} }
