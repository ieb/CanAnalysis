import { execFileSync } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const branchRef = 'refs/heads/pages';
const commitMessage = 'Build pages distribution';

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function resolveRef(ref, cwd) {
  try {
    return git(['rev-parse', '--verify', ref], { cwd });
  } catch {
    return null;
  }
}

const repositoryRoot = git(['rev-parse', '--show-toplevel'], {
  cwd: process.cwd(),
});
const outputDirectory = path.join(repositoryRoot, 'dist');
const outputIndex = path.join(outputDirectory, 'index.html');

try {
  await access(outputIndex);
} catch {
  throw new Error(`Missing ${outputIndex}. Run npm run build before publishing.`);
}

const temporaryDirectory = await mkdtemp(
  path.join(tmpdir(), 'can-analysis-pages-'),
);
const temporaryIndex = path.join(temporaryDirectory, 'index');
const indexEnvironment = {
  ...process.env,
  GIT_INDEX_FILE: temporaryIndex,
};

try {
  // Build a tree from dist without checking out a branch or changing the real index.
  git(['--work-tree', outputDirectory, 'add', '--all', '--force'], {
    cwd: repositoryRoot,
    env: indexEnvironment,
  });
  const tree = git(['write-tree'], {
    cwd: repositoryRoot,
    env: indexEnvironment,
  });

  const previousCommit = resolveRef(branchRef, repositoryRoot);
  let buildIsCurrent = false;
  if (previousCommit) {
    const previousTree = git(['rev-parse', `${branchRef}^{tree}`], {
      cwd: repositoryRoot,
    });
    buildIsCurrent = tree === previousTree;
  }

  if (buildIsCurrent) {
    console.log('The pages branch already contains the current build.');
  } else {
    const commitArguments = ['commit-tree', tree];
    if (previousCommit) {
      commitArguments.push('-p', previousCommit);
    }
    commitArguments.push('-m', commitMessage);

    const commit = git(commitArguments, { cwd: repositoryRoot });
    const updateArguments = ['update-ref', branchRef, commit];
    if (previousCommit) {
      updateArguments.push(previousCommit);
    }
    git(updateArguments, { cwd: repositoryRoot });

    console.log(`Created pages branch commit ${commit.slice(0, 12)}.`);
    console.log('Publish it with: git push origin pages');
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
