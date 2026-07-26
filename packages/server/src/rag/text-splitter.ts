import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export function createTextSplitter() {
  return new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 120,
  });
}
