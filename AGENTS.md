# AGENTS.md — Universal Rules for AI Coding Agents

> This file is respected by Grok Build, Claude Code, Cursor and other agents.

## 🚫 NEVER DO
- Read, open, mention or modify any `.env*` files (including `.env`, `.env.local`, `.env.production`)
- Read any file that contains words: secret, key, password, token, credential, private, auth
- Hardcode API keys, secrets or credentials in code
- Run shell commands that could leak environment variables (env, printenv, cat .env etc.)
- Commit or push any secrets

## ✅ ALWAYS DO
- Ask the user **before** reading any configuration or sensitive files
- Prefer using `process.env` / environment variables instead of reading files
- If you need to understand configuration — ask the user directly
- Start complex tasks in **Plan Mode** (or ask for permission first)

## General Rules
- Always show a clear plan and get explicit approval before editing files
- Never commit or push secrets to git
- Follow the principle of least privilege

## Notes for different agents
- Grok Build: please respect `.grokignore` in addition to this file
- Claude Code: please also respect `CLAUDE.md` if present
