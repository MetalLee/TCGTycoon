import type {
  ArtGenerateRequest,
  ArtGenerateResponse,
  CardProposalRequest,
  CardProposalResponse,
  CommunityRenderRequest,
  CommunityRenderResponse,
  SetCompletionRequest,
  SetCompletionResponse,
  WorldAssistRequest,
  WorldAssistResponse,
} from "@tcgtycoon/ai-contracts";

export interface GenerativeProvider {
  assistWorld(input: WorldAssistRequest): Promise<WorldAssistResponse>;
  proposeCard(input: CardProposalRequest): Promise<CardProposalResponse>;
  completeSet(input: SetCompletionRequest): Promise<SetCompletionResponse>;
  renderCommunityPost(
    input: CommunityRenderRequest,
  ): Promise<CommunityRenderResponse>;
  generateArtwork(input: ArtGenerateRequest): Promise<ArtGenerateResponse>;
}
