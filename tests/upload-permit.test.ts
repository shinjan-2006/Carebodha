import {describe,it,expect,beforeEach} from "vitest";
import {issueUploadPermit,verifyUploadPermit} from "../src/lib/upload-permit";
describe("private upload authorization",()=>{
  beforeEach(()=>{process.env.BETTER_AUTH_SECRET="isolated-test-upload-secret-never-used-in-production";});
  const input={actorId:"clinician-a",patientId:"patient-a",name:"source.pdf",mimeType:"application/pdf" as const};
  it("binds the storage key to the clinician and patient",()=>{const permit=issueUploadPermit(input);expect(verifyUploadPermit(permit.proof,input.actorId)).toMatchObject({...input,key:permit.pathname});expect(()=>verifyUploadPermit(permit.proof,"clinician-b")).toThrow();});
  it("rejects changed patient metadata and expired authorization",()=>{const permit=issueUploadPermit(input);const [payload,sig]=permit.proof.split(".");const metadata=JSON.parse(Buffer.from(payload,"base64url").toString());metadata.patientId="patient-b";expect(()=>verifyUploadPermit(Buffer.from(JSON.stringify(metadata)).toString("base64url")+"."+sig,input.actorId)).toThrow();const now=Date.now;Date.now=()=>now()+16*60000;try{expect(()=>verifyUploadPermit(permit.proof,input.actorId)).toThrow();}finally{Date.now=now;}});
});
