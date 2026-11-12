/**
 * The code of the order-statistic tree (ADR 0034): a red–black tree whose
 * nodes keep the size of their subtree. Selection and rank read the
 * sizes; insertion and deletion keep them, and call the red–black fixups,
 * whose rotations keep them too, without repeating their code.
 */
import { listing } from '../../snippet.ts';

export const OS_SELECT = listing('select', {
  pseudocode: `
    OS-SELECT(x, i)  // the ith smallest key below x, i from 1
        while TRUE
            r = x.left.size + 1  // x's rank among its own subtree
            if i == r
                return x  // @found
            elseif i < r
                x = x.left  // @left
            else i = i - r; x = x.right  // @right
  `,
  python: `
    def size(x):
        return x.size if x else 0

    def select(x, i):
        # the ith smallest key below x, i from 1
        while True:
            r = size(x.left) + 1  # x's rank among its own subtree
            if i == r:
                return x  # @found
            if i < r:
                x = x.left  # @left
            else:
                i, x = i - r, x.right  # @right
  `,
});

export const OS_RANK = listing('rank', {
  pseudocode: `
    OS-RANK(T, key)
        x = T.root
        while x ≠ NIL and key ≠ x.key  // @find
            if key < x.key
                x = x.left
            else x = x.right
        if x == NIL
            return NIL  // not in the tree  // @missing
        r = x.left.size + 1  // x's rank among its own subtree  // @start
        y = x
        while y ≠ T.root
            if y == y.p.right
                r = r + y.p.left.size + 1  // @add
            y = y.p  // @up
        return r  // @rank
  `,
  python: `
    # size(x) is x.size, or 0 for None, as in select
    def rank(T, key):
        x = T.root
        while x and key != x.key:  # @find
            x = x.left if key < x.key else x.right
        if x is None:
            return None  # not in the tree  # @missing
        r = size(x.left) + 1  # x's rank among its own subtree  # @start
        y = x
        while y is not T.root:
            if y is y.p.right:
                r += size(y.p.left) + 1  # @add
            y = y.p  # @up
        return r  # @rank
  `,
});

export const OS_INSERT = listing('insert', {
  pseudocode: `
    OS-INSERT(T, key)
        if TREE-SEARCH(T.root, key) ≠ NIL
            return  // already in the tree: no size changes  // @present
        y = NIL
        x = T.root
        while x ≠ NIL
            x.size = x.size + 1  // the new key goes below x  // @go
            y = x
            if key < x.key
                x = x.left
            else x = x.right
        z = a new red node with key; z.size = 1; z.p = y  // @new
        if y == NIL
            T.root = z
        elseif key < y.key
            y.left = z
        else y.right = z
        RB-INSERT-FIXUP(T, z)  // as for red–black trees  // @fixup

    LEFT-ROTATE(T, x)  // as for red–black trees, then:
        y.size = x.size  // y takes x's place, and x's subtree
        x.size = x.left.size + x.right.size + 1
  `,
  python: `
    # size(x) is x.size, or 0 for None, as in select
    def insert(T, key):
        if search(T.root, key):
            return  # already in the tree: no size changes  # @present
        y, x = None, T.root
        while x:
            x.size += 1  # the new key goes below x  # @go
            y = x
            x = x.left if key < x.key else x.right
        z = Node(key, RED, p=y, size=1)  # @new
        if y is None:
            T.root = z
        elif key < y.key:
            y.left = z
        else:
            y.right = z
        insert_fixup(T, z)  # as for red-black trees  # @fixup

    def rotate(T, x, side):
        y = rb_rotate(T, x, side)  # as for red-black trees
        y.size = x.size
        x.size = size(x.left) + size(x.right) + 1
  `,
});

export const OS_DELETE = listing('delete', {
  pseudocode: `
    OS-DELETE(T, key)
        z = T.root
        while z ≠ NIL and key ≠ z.key  // @find
            if key < z.key
                z = z.left
            else z = z.right
        if z == NIL
            return  // not in the tree  // @missing
        lost = z.color
        // x may be the sentinel NIL; RB-TRANSPLANT sets its p
        if z.left == NIL
            x = z.right; RB-TRANSPLANT(T, z, x)  // @no-left
        elseif z.right == NIL
            x = z.left; RB-TRANSPLANT(T, z, x)  // @no-right
        else
            y = TREE-MINIMUM(z.right)  // @successor
            lost = y.color
            x = y.right
            if y.p == z
                x.p = y
            else
                RB-TRANSPLANT(T, y, x)
                y.right = z.right; y.right.p = y
            RB-TRANSPLANT(T, z, y)  // @move-up
            y.left = z.left; y.left.p = y
            y.color = z.color
        for each node v from x.p up to the root  // @update
            v.size = v.left.size + v.right.size + 1
        if lost == BLACK  // @done
            RB-DELETE-FIXUP(T, x)  // as for red–black trees  // @fixup

    LEFT-ROTATE(T, x)  // as for red–black trees, then:
        y.size = x.size  // y takes x's place, and x's subtree
        x.size = x.left.size + x.right.size + 1
  `,
  python: `
    # size(x) is x.size, or 0 for None, as in select
    def delete(T, key):
        z = T.root
        while z and key != z.key:  # @find
            z = z.left if key < z.key else z.right
        if z is None:
            return  # not in the tree  # @missing
        lost = z.color
        if z.left is None:
            x, xp = z.right, z.p  # @no-left
            transplant(T, z, x)
        elif z.right is None:
            x, xp = z.left, z.p  # @no-right
            transplant(T, z, x)
        else:
            y = minimum(z.right)  # @successor
            lost, x = y.color, y.right
            if y.p is z:
                xp = y
            else:
                xp = y.p
                transplant(T, y, x)
                y.right, y.right.p = z.right, y
            transplant(T, z, y)  # @move-up
            y.left, y.left.p = z.left, y
            y.color = z.color
        v = xp
        while v:
            v.size = size(v.left) + size(v.right) + 1  # @update
            v = v.p
        if lost == BLACK:  # @done
            delete_fixup(T, x, xp)  # as for red-black trees  # @fixup

    def rotate(T, x, side):
        y = rb_rotate(T, x, side)  # as for red-black trees
        y.size = x.size
        x.size = size(x.left) + size(x.right) + 1
  `,
});

/** The fixups' steps, at the line that calls them. */
export const INSERT_FIXUP_STANDS = {
  'case-1': 'fixup',
  'case-2': 'fixup',
  'case-3': 'fixup',
  fixed: 'fixup',
  root: 'fixup',
} as const;

export const DELETE_FIXUP_STANDS = {
  'case-1': 'fixup',
  'case-2': 'fixup',
  'case-3': 'fixup',
  'case-4': 'fixup',
  'x-black': 'fixup',
} as const;
