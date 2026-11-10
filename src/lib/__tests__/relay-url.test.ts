import { describe, it, expect } from "vitest";
import { isSafeRelayUrl } from "../relay.functions";
describe("isSafeRelayUrl", () => {
  it("accepts public https", () => expect(isSafeRelayUrl("https://notify.example.com/api")).toBe(true));
  it("rejects http", () => expect(isSafeRelayUrl("http://notify.example.com")).toBe(false));
  it("rejects localhost and private IPs", () => {
    expect(isSafeRelayUrl("https://localhost/x")).toBe(false);
    expect(isSafeRelayUrl("https://192.168.1.5/x")).toBe(false);
    expect(isSafeRelayUrl("https://169.254.169.254/x")).toBe(false);
  });
});
