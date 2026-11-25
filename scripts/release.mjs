#!/usr/bin/env node
/**
 * Release the travel agent: bump the version, commit and push it, then list that commit in index.json, the plugin index
 * DSH's Plugins > Discover reads. A copy installed from Discover then shows Update for every newer release.
 *
 *   node scripts/release.mjs            # patch: 0.8.0 -> 0.8.1
 *   node scripts/release.mjs minor      # 0.8.1 -> 0.9.0
 *   node scripts/release.mjs 1.0.0      # an exact version
 *   node scripts/release.mjs --notes "回程到家时间更醒目"
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const readJson = file => JSON.parse(readFileSync(join(root, file), 'utf8'))
const writeJson = (file, value) => writeFileSync(join(root, file), JSON.stringify(value, null, 2) + '\n')

const args = process.argv.slice(2)
const notesAt = args.indexOf('--notes')
const notes = notesAt === -1 ? undefined : args.splice(notesAt, 2)[1]
const bump = args[0] ?? 'patch'

if (git('status', '--porcelain') !== '') throw new Error('Commit or stash your changes first: the release commit must contain exactly what was tested.')
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
git('fetch', '--quiet', 'origin', branch)
if (git('rev-list', '--count', `HEAD..origin/${branch}`) !== '0') throw new Error(`origin/${branch} has commits you do not; pull first.`)

const pkg = readJson('package.json')
const [major, minor, patch] = pkg.version.split('-')[0].split('.').map(Number)
const version = /^\d+\.\d+\.\d+$/.test(bump) ? bump
  : bump === 'major' ? `${major + 1}.0.0`
  : bump === 'minor' ? `${major}.${minor + 1}.0`
  : bump === 'patch' ? `${major}.${minor}.${patch + 1}`
  : undefined
if (version === undefined) throw new Error(`Unknown bump "${bump}": use patch, minor, major or an exact version.`)

// 1. The release commit: package.json carries the version DSH checks when it installs this commit.
pkg.version = version
writeJson('package.json', pkg)
git('add', 'package.json')
git('commit', '--quiet', '-m', `Release v${version}`)
const commit = git('rev-parse', 'HEAD')
git('tag', `v${version}`)

// 2. The index commit: Discover reads index.json from the default branch and offers this version as an update.
const remote = git('remote', 'get-url', 'origin').replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '')
const index = readJson('index.json')
const entry = index.plugins.find(plugin => plugin.name === pkg.name)
entry.versions = [
  {
    version,
    publishTimestamp: Math.floor(Date.now() / 1000),
    source: { type: 'git', url: remote, commit },
    ...(notes === undefined ? {} : { description: notes }),
  },
  ...entry.versions.filter(item => item.version !== version),
]
entry['dist-tags'] = { latest: version }
writeJson('index.json', index)
git('add', 'index.json')
git('commit', '--quiet', '-m', `List v${version} in the plugin index`)
git('push', '--quiet', 'origin', branch, `v${version}`)
console.log(`Released v${version} at ${commit}. Discover offers it as an update.`)
