/** 사용자에게 그대로 보여줄 수 있는 메시지를 가진 피드 오류 */
export class FeedFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedFetchError";
  }
}
