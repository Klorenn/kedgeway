import type { PageMetaDict, Rich } from "./common";

export type AuthStep = "registration" | "pkce" | "callback" | "browser" | "token";
export type AuthTrouble = "port" | "browser" | "timeout" | "rejected";

export interface DocsAuthenticationDict {
  meta: PageMetaDict;
  h1: string;
  lede: Rich;
  howH: string;
  how: Record<AuthStep, Rich>;
  wait: Rich;
  whenH: string;
  whenP: Rich;
  whereH: string;
  warning: Rich;
  whereP: Rich;
  deleteP: Rich;
  sentH: string;
  sentP: Rich;
  headlessH: string;
  headlessP: Rich;
  headlessAfter: Rich;
  finish: Record<"paste" | "forward", Rich>;
  checked: Rich;
  forCi: Rich;
  ciH: string;
  ciP: Rich;
  troubleH: string;
  trouble: Record<AuthTrouble, { dt: string; dd: Rich }>;
}
