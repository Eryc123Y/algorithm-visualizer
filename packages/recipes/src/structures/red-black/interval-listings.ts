/**
 * The code of the interval tree (ADR 0034): a red–black tree of intervals
 * ordered by their low endpoints, each node keeping the greatest high
 * endpoint in its subtree. Search reads the maxima; insertion and deletion
 * keep them, and call the red–black fixups, whose rotations keep them
 * too, without repeating their code. NIL's max is −∞.
 */
import { listing } from '../../snippet.ts';

export const INTERVAL_SEARCH = listing('search', {
  pseudocode: `
    INTERVAL-SEARCH(T, i)  // an interval of T that overlaps i, or NIL
        x = T.root
        while x ≠ NIL and (i.high < x.int.low or x.int.high < i.low)
            if x.left ≠ NIL and x.left.max ≥ i.low
                x = x.left  // an overlap, if any, is on the left  // @left
            else x = x.right  // @right
        return x  // @found
  `,
  python: `
    def search(T, i):
        # an interval of T that overlaps i, or None
        x = T.root
        while x and (i.high < x.low or x.high < i.low):
            if x.left and x.left.max >= i.low:
                x = x.left  # an overlap, if any, is on the left  # @left
            else:
                x = x.right  # @right
        return x  # @found
  `,
});

export const INTERVAL_INSERT = listing('insert', {
  pseudocode: `
    INTERVAL-INSERT(T, i)  // the tree is ordered by low, then high
        if TREE-SEARCH(T.root, i) ≠ NIL
            return  // already in the tree: no max changes  // @present
        y = NIL
        x = T.root
        while x ≠ NIL
            x.max = max(x.max, i.high)  // i goes below x  // @go
            y = x
            if i < x.int
                x = x.left
            else x = x.right
        z = a new red node with i; z.max = i.high; z.p = y  // @new
        if y == NIL
            T.root = z
        elseif i < y.int
            y.left = z
        else y.right = z
        RB-INSERT-FIXUP(T, z)  // as for red–black trees  // @fixup

    LEFT-ROTATE(T, x)  // as for red–black trees, then:
        y.max = x.max  // y takes x's place, and x's subtree
        x.max = max(x.int.high, x.left.max, x.right.max)
  `,
  python: `
    def high_max(x):
        return x.max if x else float('-inf')

    def insert(T, i):
        # the tree is ordered by low, then high
        if search_exact(T.root, i):
            return  # already in the tree: no max changes  # @present
        y, x = None, T.root
        while x:
            x.max = max(x.max, i.high)  # i goes below x  # @go
            y = x
            x = x.left if i < x.int else x.right
        z = Node(i, RED, p=y, max=i.high)  # @new
        if y is None:
            T.root = z
        elif i < y.int:
            y.left = z
        else:
            y.right = z
        insert_fixup(T, z)  # as for red-black trees  # @fixup

    def rotate(T, x, side):
        y = rb_rotate(T, x, side)  # as for red-black trees
        y.max = x.max
        x.max = max(x.high, high_max(x.left), high_max(x.right))
  `,
});

export const INTERVAL_DELETE = listing('delete', {
  pseudocode: `
    INTERVAL-DELETE(T, i)
        z = T.root
        while z ≠ NIL and i ≠ z.int  // @find
            if i < z.int
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
            v.max = max(v.int.high, v.left.max, v.right.max)
        if lost == BLACK  // @done
            RB-DELETE-FIXUP(T, x)  // as for red–black trees  // @fixup
  `,
  python: `
    def delete(T, i):
        z = T.root
        while z and i != z.int:  # @find
            z = z.left if i < z.int else z.right
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
            v.max = max(v.high, high_max(v.left), high_max(v.right))  # @update
            v = v.p
        if lost == BLACK:  # @done
            delete_fixup(T, x, xp)  # as for red-black trees  # @fixup
  `,
});
