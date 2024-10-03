# verdux

#### Redux + RxJS + TypeScript = ❤️

> Model your application as a reactive, directed acyclic graph.
> A graph is composed of vertices. Hence the name (vertex + redux = verdux). Duh.

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

-  [Motivation](#motivation)
-  [What is `verdux` ?](#what-is-verdux-)
-  [Features](#features)
-  [But `redux` sucks, right ?](#but-redux-sucks-right-)
-  [Install](#install)
-  [Examples](#examples)
-  [Testing](#testing)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Motivation

##### After years of maintaining frontend applications, we have come to realize that :

-  The human brain is naturally wired to process tree-like structures
-  UI applications are most intuitively respresented as hierarchical graphs
-  Asynchronicity is an essential dimension of frontend apps, and the source of most accidental complexity
-  Reactive programming is just too powerful a tool not to use

## What is `verdux` ?

##### `verdux` is a state management + asynchronous orchestration library that :

-  Models UI application state as a flow of data streaming through a directed acyclic graph
-  Allows better separation of concern, each vertex in the graph is self-contained and self-sufficient
-  Is designed from the ground up to provide maximum type safety
-  Embraces asynchronicity in its core using the power of `RxJS`
-  Reduces accidental complexity for most typical front UI cases
-  Prevents unnecessary re-rendering, without any manual memoization

## Features

-  Integration with vanilla `redux` and `redux-toolkit`
-  Declarative data fetching supporting cascade loading
-  Automatic refetching and error propagation
-  Epics, just like [`redux-observable`](https://github.com/redux-observable/redux-observable), our favorite redux middleware
-  Some other cool stuff

## Examples

https://github.com/couzic/verdux-examples

## DevTools (WIP)

![DevTools screenshot](doc/devtools.png)

## But `redux` sucks, right ?

A lot of people have complained about `redux`, some with good reason. Many have been drawn to other state management solutions.

> Don't throw the baby with the bathwater.

Although we agree there must be a better way than classical `redux`, we are not willing to sacrifice all of the `redux` goodness you've heard so much about.

> Making redux great again !

## Install

```bash
npm install verdux @reduxjs/toolkit rxjs
```

## Testing

> Testing an action creator, a reducer and a selector in isolation.

![Man in three pieces. Legs running in place. Torso doing push-ups. Head reading.](https://cdn-images-1.medium.com/max/1600/0*eCs8GoVZVksoQtQx.gif)

> "Looks like it’s working !"

Testing in `redux` usually implies testing in isolation the pieces that together form the application's state management system. It seems reasonable, since they are supposed to be pure functions.

Testing in `verdux` follows a different approach. A vertex is to be considered a cohesive **unit** of functionality. We want to **test it as a whole**, by interacting with it like the UI component would. We do not want to test its internal implementation details.

As a consequence, we believe vertex testing should essentially consist in :

-  Dispatching actions
-  Asserting state
<!-- -  [Dispatching actions](#dispatch)
-  [Asserting state](#asserting-state) (normalized state + computed values + loaded values) -->

In some less frequent cases, testing might also consist in :

-  Asserting calls on dependencies
-  Asserting dispatched actions
<!-- -  [Asserting calls on dependencies](#asserting-calls-on-dependencies)
-  [Asserting dispatched actions](#asserting-dispatched-actions) -->
