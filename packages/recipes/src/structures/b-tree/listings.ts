/**
 * The code of B-tree search, insertion and deletion (ADR 0035), in
 * pseudocode in CLRS's conventions, with indices from 0, and in Python,
 * written for this project. CLRS gives deletion in prose; this pseudocode
 * follows its cases, which name the steps.
 */
import { listing } from '../../snippet.ts';

export const BT_SEARCH = listing('search', {
  pseudocode: `
    B-TREE-SEARCH(x, k)
        i = 0
        while i < x.n and k > x.key[i]
            i = i + 1
        if i < x.n and k == x.key[i]
            return (x, i)  // @found
        elseif x.leaf
            return NIL  // @missing
        else return B-TREE-SEARCH(x.c[i], k)  // @down
  `,
  python: `
    def search(x, k):
        i = 0
        while i < len(x.keys) and k > x.keys[i]:
            i += 1
        if i < len(x.keys) and k == x.keys[i]:
            return x, i  # @found
        if x.leaf:
            return None  # @missing
        return search(x.c[i], k)  # @down
  `,
});

export const BT_INSERT = listing('insert', {
  pseudocode: `
    B-TREE-INSERT(T, k)  // one pass down, splitting full nodes first
        if B-TREE-SEARCH(T.root, k) ≠ NIL
            return  // already in the tree  // @present
        r = T.root
        if r.n == 2t - 1
            s = a new node with no keys, s.c[0] = r; T.root = s  // @grow
            B-TREE-SPLIT-CHILD(s, 0)
        x = T.root
        while not x.leaf
            i = the number of keys of x less than k
            if x.c[i].n == 2t - 1
                B-TREE-SPLIT-CHILD(x, i)  // @split
                if k > x.key[i]
                    i = i + 1
            x = x.c[i]  // @down
        insert k into x at its place  // @leaf

    B-TREE-SPLIT-CHILD(x, i)  // x.c[i] is full: 2t − 1 keys
        y = x.c[i]; z = a new node
        z takes y's last t − 1 keys and, unless y is a leaf, its last t children
        y keeps its first t − 1 keys and t children
        insert y.key[t − 1] into x at i, and z into x's children at i + 1
  `,
  python: `
    def insert(T, k):
        # one pass down, splitting full nodes first
        if search(T.root, k):
            return  # already in the tree  # @present
        r = T.root
        if len(r.keys) == 2 * t - 1:
            T.root = Node(c=[r])  # @grow
            split_child(T.root, 0)
        x = T.root
        while not x.leaf:
            i = bisect_left(x.keys, k)
            if len(x.c[i].keys) == 2 * t - 1:
                split_child(x, i)  # @split
                if k > x.keys[i]:
                    i += 1
            x = x.c[i]  # @down
        insort(x.keys, k)  # @leaf

    def split_child(x, i):
        y = x.c[i]
        z = Node(keys=y.keys[t:], c=y.c[t:])
        x.keys.insert(i, y.keys[t - 1])
        x.c.insert(i + 1, z)
        y.keys, y.c = y.keys[:t - 1], y.c[:t]
  `,
});

export const BT_DELETE = listing('delete', {
  pseudocode: `
    B-TREE-DELETE(x, k)  // x is the root, or has at least t keys
        i = the number of keys of x less than k
        if i < x.n and k == x.key[i]
            if x.leaf
                remove k from x  // case 1  // @case-1
            elseif x.c[i].n ≥ t
                k' = the greatest key below x.c[i]  // case 2a  // @case-2a
                B-TREE-DELETE(x.c[i], k'); put k' in k's place  // @lift-pred
            elseif x.c[i + 1].n ≥ t
                k' = the least key below x.c[i + 1]  // case 2b  // @case-2b
                B-TREE-DELETE(x.c[i + 1], k'); put k' in k's place  // @lift-succ
            else
                MERGE(x, i)  // case 2c: x.c[i] gets k and x.c[i + 1]  // @case-2c
                B-TREE-DELETE(x.c[i], k)
        elseif x.leaf
            return  // k is not in the tree  // @missing
        else
            if x.c[i].n == t - 1
                if a sibling of x.c[i] has at least t keys
                    move a key from it up into x and one from x down  // case 3a  // @case-3a
                else
                    MERGE(x.c[i] with a sibling and the key between)  // case 3b  // @case-3b
            B-TREE-DELETE(the child of x that holds k's place, k)  // @down
        if T.root.n == 0 and not T.root.leaf
            T.root = T.root.c[0]  // the tree loses a level  // @shrink
  `,
  python: `
    def delete(x, k):
        # x is the root, or has at least t keys
        i = bisect_left(x.keys, k)
        if i < len(x.keys) and x.keys[i] == k:
            if x.leaf:
                x.keys.pop(i)  # case 1  # @case-1
            elif len(x.c[i].keys) >= t:
                kp = greatest(x.c[i])  # case 2a  # @case-2a
                delete(x.c[i], kp); x.keys[i] = kp  # @lift-pred
            elif len(x.c[i + 1].keys) >= t:
                kp = least(x.c[i + 1])  # case 2b  # @case-2b
                delete(x.c[i + 1], kp); x.keys[i] = kp  # @lift-succ
            else:
                merge(x, i)  # case 2c  # @case-2c
                delete(x.c[i], k)
        elif x.leaf:
            return  # k is not in the tree  # @missing
        else:
            if len(x.c[i].keys) == t - 1:
                if can_borrow(x, i):
                    borrow(x, i)  # case 3a  # @case-3a
                else:
                    i = merge_with_sibling(x, i)  # case 3b  # @case-3b
            delete(x.c[i], k)  # @down
        if not T.root.keys and not T.root.leaf:
            T.root = T.root.c[0]  # the tree loses a level  # @shrink
  `,
});
