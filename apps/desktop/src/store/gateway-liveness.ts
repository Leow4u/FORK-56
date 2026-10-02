import { atom } from 'nanostores'

// Bare LOCAL profile names that currently hold a renderer-owned socket (the
// primary backend's profile plus every pooled secondary on the local path).
// Written only by store/gateway's registry; read by the profile rail for its
// "running / asleep" dots. Lives in its own dependency-free module so the
// profile store can subscribe to it without importing the socket registry
// (and so tests that stub '@/store/gateway' keep a real atom here).
export const $liveGatewayProfiles = atom<ReadonlySet<string>>(new Set())
