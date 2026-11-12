/**
 * The code of red–black insertion and deletion (ADR 0034), in pseudocode
 * in CLRS's conventions and in Python, written for this project. NIL is
 * black. The pseudocode writes one side of each fixup and says that the
 * other mirrors it, as textbooks do; the Python names the side, so both
 * sides run the same lines.
 */
import { listing } from '../../snippet.ts';

export const RB_INSERT = listing('insert', {
  pseudocode: `
    RB-INSERT(T, key)
        y = NIL  // the parent-to-be
        x = T.root
        while x ≠ NIL
            if key == x.key
                return  // already in the tree  // @present
            y = x
            if key < x.key  // @go
                x = x.left
            else x = x.right
        z = a new red node with key; z.p = y  // @new
        if y == NIL
            T.root = z
        elseif key < y.key
            y.left = z
        else y.right = z
        RB-INSERT-FIXUP(T, z)

    RB-INSERT-FIXUP(T, z)  // repair a red z with a red parent
        while z.p.color == RED  // @fixed
            if z.p == z.p.p.left
                u = z.p.p.right  // the uncle
                if u.color == RED
                    z.p.color = BLACK; u.color = BLACK  // @case-1
                    z.p.p.color = RED
                    z = z.p.p
                else
                    if z == z.p.right
                        z = z.p; LEFT-ROTATE(T, z)  // @case-2
                    z.p.color = BLACK; z.p.p.color = RED  // @case-3
                    RIGHT-ROTATE(T, z.p.p)
            else mirror the branch above, swapping left and right
        T.root.color = BLACK  // @root

    LEFT-ROTATE(T, x)  // RIGHT-ROTATE mirrors it
        y = x.right  // y rises, x sinks to its left
        x.right = y.left
        if y.left ≠ NIL
            y.left.p = x
        RB-TRANSPLANT(T, x, y)
        y.left = x
        x.p = y

    RB-TRANSPLANT(T, u, v)  // put v where u hangs
        if u.p == NIL
            T.root = v
        elseif u == u.p.left
            u.p.left = v
        else u.p.right = v
        if v ≠ NIL
            v.p = u.p
  `,
  python: `
    def color(x):
        return x.color if x else BLACK  # NIL is black

    def insert(T, key):
        y, x = None, T.root
        while x:
            if key == x.key:
                return  # already in the tree  # @present
            y = x
            x = x.left if key < x.key else x.right  # @go
        z = Node(key, RED, p=y)  # @new
        if y is None:
            T.root = z
        elif key < y.key:
            y.left = z
        else:
            y.right = z
        insert_fixup(T, z)

    def insert_fixup(T, z):
        while color(z.p) == RED:  # @fixed
            g = z.p.p
            side = 'left' if z.p is g.left else 'right'
            far = 'right' if side == 'left' else 'left'
            u = getattr(g, far)  # the uncle
            if color(u) == RED:
                z.p.color = u.color = BLACK  # @case-1
                g.color = RED
                z = g
            else:
                if z is getattr(z.p, far):
                    z = z.p; rotate(T, z, side)  # @case-2
                z.p.color, g.color = BLACK, RED  # @case-3
                rotate(T, g, far)
        T.root.color = BLACK  # @root

    def rotate(T, x, side):
        # side 'left' lifts x.right, 'right' lifts x.left
        up = 'right' if side == 'left' else 'left'
        y = getattr(x, up)
        inner = getattr(y, side)
        setattr(x, up, inner)
        if inner:
            inner.p = x
        transplant(T, x, y)
        setattr(y, side, x)
        x.p = y

    def transplant(T, u, v):
        # put v where u hangs
        if u.p is None:
            T.root = v
        elif u is u.p.left:
            u.p.left = v
        else:
            u.p.right = v
        if v:
            v.p = u.p
  `,
});

export const RB_DELETE = listing('delete', {
  pseudocode: `
    RB-DELETE(T, key)
        z = T.root
        while z ≠ NIL and key ≠ z.key  // @find
            if key < z.key
                z = z.left
            else z = z.right
        if z == NIL
            return  // not in the tree  // @missing
        lost = z.color  // the colour that leaves its place
        if z.left == NIL
            x = z.right; RB-TRANSPLANT(T, z, x)  // @no-left
        elseif z.right == NIL
            x = z.left; RB-TRANSPLANT(T, z, x)  // @no-right
        else
            y = TREE-MINIMUM(z.right)  // @successor
            lost = y.color
            x = y.right  // x.p is set even when x is NIL
            if y.p == z
                x.p = y
            else
                RB-TRANSPLANT(T, y, x)
                y.right = z.right; y.right.p = y
            RB-TRANSPLANT(T, z, y)  // @move-up
            y.left = z.left; y.left.p = y
            y.color = z.color
        if lost == BLACK  // @done
            RB-DELETE-FIXUP(T, x)

    RB-DELETE-FIXUP(T, x)  // x carries an extra black
        while x ≠ T.root and x.color == BLACK
            if x == x.p.left
                w = x.p.right  // the sibling
                if w.color == RED
                    w.color = BLACK; x.p.color = RED  // @case-1
                    LEFT-ROTATE(T, x.p); w = x.p.right
                if w.left.color == BLACK and w.right.color == BLACK
                    w.color = RED; x = x.p  // @case-2
                else
                    if w.right.color == BLACK
                        w.left.color = BLACK; w.color = RED  // @case-3
                        RIGHT-ROTATE(T, w); w = x.p.right
                    w.color = x.p.color; x.p.color = BLACK  // @case-4
                    w.right.color = BLACK
                    LEFT-ROTATE(T, x.p); x = T.root
            else mirror the branch above, swapping left and right
        x.color = BLACK  // @x-black

    LEFT-ROTATE, RIGHT-ROTATE and RB-TRANSPLANT as for insertion
  `,
  python: `
    def delete(T, key):
        z = T.root
        while z and key != z.key:  # @find
            z = z.left if key < z.key else z.right
        if z is None:
            return  # not in the tree  # @missing
        lost = z.color  # the colour that leaves its place
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
                y.right = z.right
                y.right.p = y
            transplant(T, z, y)  # @move-up
            y.left, y.left.p = z.left, y
            y.color = z.color
        if lost == BLACK:  # @done
            delete_fixup(T, x, xp)

    def delete_fixup(T, x, xp):
        # x may be None (NIL); xp is its parent
        while x is not T.root and color(x) == BLACK:
            side = 'left' if x is xp.left else 'right'
            far = 'right' if side == 'left' else 'left'
            w = getattr(xp, far)  # the sibling
            if color(w) == RED:
                w.color, xp.color = BLACK, RED  # @case-1
                rotate(T, xp, side)
                w = getattr(xp, far)
            if color(w.left) == color(w.right) == BLACK:
                w.color = RED  # @case-2
                x, xp = xp, xp.p
            else:
                if color(getattr(w, far)) == BLACK:
                    getattr(w, side).color = BLACK  # @case-3
                    w.color = RED
                    rotate(T, w, far)
                    w = getattr(xp, far)
                w.color, xp.color = xp.color, BLACK  # @case-4
                getattr(w, far).color = BLACK
                rotate(T, xp, side)
                x = T.root
        if x:
            x.color = BLACK  # @x-black

    # color, rotate and transplant as for insertion
  `,
});
