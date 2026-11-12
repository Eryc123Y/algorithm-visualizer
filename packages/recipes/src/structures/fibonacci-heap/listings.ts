/**
 * The code of the Fibonacci heap's operations (ADR 0034), in pseudocode
 * in CLRS's conventions and in Python, written for this project. The root
 * list and every list of children are circular doubly linked lists, so a
 * node joins or leaves one in constant time; the Python leaves those list
 * helpers (`splice_left`, `unlink`) out.
 */
import { listing } from '../../snippet.ts';

export const FIB_INSERT = listing('insert', {
  pseudocode: `
    FIB-HEAP-INSERT(H, key)
        x = a new node with key, degree 0, no parent or child, unmarked
        if H.min == NIL
            the root list is just x; H.min = x  // @first
        else
            put x in the root list, just left of H.min  // @insert
            if x.key < H.min.key
                H.min = x  // @new-min
        H.n = H.n + 1
  `,
  python: `
    def insert(H, key):
        x = Node(key)  # degree 0, no parent or child, unmarked
        if H.min is None:
            H.min = x  # a root list of one  # @first
        else:
            splice_left(H.min, x)  # just left of H.min  # @insert
            if x.key < H.min.key:
                H.min = x  # @new-min
        H.n += 1
  `,
});

export const FIB_UNION = listing('union', {
  pseudocode: `
    FIB-HEAP-UNION(H, H2)  // H takes every tree of H2  // @second
        join H2's root list to H's  // @join
        if H.min == NIL or (H2.min ≠ NIL and H2.min.key < H.min.key)
            H.min = H2.min  // @new-min
        H.n = H.n + H2.n
  `,
  python: `
    def union(H, H2):  # @second
        # H takes every tree of H2
        concat(H.min, H2.min)  # join the two root lists  # @join
        if H.min is None or (H2.min and H2.min.key < H.min.key):
            H.min = H2.min  # @new-min
        H.n += H2.n
  `,
});

export const FIB_EXTRACT_MIN = listing('extract-min', {
  pseudocode: `
    FIB-HEAP-EXTRACT-MIN(H)
        z = H.min
        for each child x of z
            put x in the root list where z is; x.p = NIL  // @children
        take z out of the root list  // @remove
        if z == z.right
            H.min = NIL  // the heap is now empty  // @empty
        else
            H.min = z.right
            CONSOLIDATE(H)
        H.n = H.n - 1
        return z

    CONSOLIDATE(H)  // until no two roots have the same degree
        A = a new array A[0 : D(H.n)] of NIL  // @array
        for each node w in the root list, once round from H.min
            x = w; d = x.degree  // @root
            while A[d] ≠ NIL
                y = A[d]  // another root of degree d
                if x.key > y.key
                    exchange x with y
                FIB-HEAP-LINK(H, y, x)  // @link
                A[d] = NIL; d = d + 1
            A[d] = x  // @store
        H.min = NIL
        for i = 0 to D(H.n)  // @rebuild
            if A[i] ≠ NIL
                put A[i] in the root list
                if H.min == NIL or A[i].key < H.min.key
                    H.min = A[i]

    FIB-HEAP-LINK(H, y, x)  // y becomes a child of x
        take y out of the root list
        make y a child of x; x.degree = x.degree + 1
        y.mark = FALSE
  `,
  python: `
    def extract_min(H):
        z = H.min
        for x in list(children(z)):
            splice_left(z, x)  # into the root list where z is  # @children
            x.p = None
        unlink(z)  # out of the root list  # @remove
        if z.right is z:
            H.min = None  # the heap is now empty  # @empty
        else:
            H.min = z.right
            consolidate(H)
        H.n -= 1
        return z

    def consolidate(H):
        A = [None] * (max_degree(H.n) + 1)  # @array
        for w in list(once_round_from(H.min)):
            x, d = w, w.degree  # @root
            while A[d]:
                y = A[d]  # another root of degree d
                if x.key > y.key:
                    x, y = y, x
                link(H, y, x)  # @link
                A[d] = None
                d += 1
            A[d] = x  # @store
        H.min = None
        for root in A:  # @rebuild
            if root:
                add_root(H, root)
                if H.min is None or root.key < H.min.key:
                    H.min = root

    def link(H, y, x):
        unlink(y)  # out of the root list
        add_child(x, y)  # x.degree grows by one
        y.mark = False
  `,
});

export const FIB_DECREASE_KEY = listing('decrease-key', {
  pseudocode: `
    FIB-HEAP-DECREASE-KEY(H, x, k)  // k < x.key
        x.key = k  // @decrease
        y = x.p
        if y ≠ NIL and x.key < y.key
            CUT(H, x, y)  // @cut
            CASCADING-CUT(H, y)
        if x.key < H.min.key
            H.min = x  // @new-min

    CUT(H, x, y)  // x leaves its parent y for the root list
        take x out of y's children; y.degree = y.degree - 1
        put x in the root list, just left of H.min
        x.p = NIL; x.mark = FALSE

    CASCADING-CUT(H, y)
        z = y.p
        if z ≠ NIL
            if y.mark == FALSE
                y.mark = TRUE  // y has lost a child  // @mark
            else
                CUT(H, y, z)  // y loses a second child  // @cascade
                CASCADING-CUT(H, z)
  `,
  python: `
    def decrease_key(H, x, k):
        # k < x.key
        x.key = k  # @decrease
        y = x.p
        if y and x.key < y.key:
            cut(H, x, y)  # @cut
            cascading_cut(H, y)
        if x.key < H.min.key:
            H.min = x  # @new-min

    def cut(H, x, y):
        # x leaves its parent y for the root list
        remove_child(y, x)  # y.degree drops by one
        splice_left(H.min, x)
        x.p, x.mark = None, False

    def cascading_cut(H, y):
        z = y.p
        if z:
            if not y.mark:
                y.mark = True  # y has lost a child  # @mark
            else:
                cut(H, y, z)  # y loses a second child  # @cascade
                cascading_cut(H, z)
  `,
});

export const FIB_DELETE = listing('delete', {
  pseudocode: `
    FIB-HEAP-DELETE(H, x)
        FIB-HEAP-DECREASE-KEY(H, x, −∞)  // x becomes the minimum  // @decrease
        FIB-HEAP-EXTRACT-MIN(H)  // @extract
  `,
  python: `
    def delete(H, x):
        decrease_key(H, x, float('-inf'))  # x becomes the minimum  # @decrease
        extract_min(H)  # @extract
  `,
});

/** The steps of DECREASE-KEY and EXTRACT-MIN, at the lines of DELETE. */
export const DELETE_STANDS: Readonly<Record<string, string>> = {
  cut: 'decrease',
  mark: 'decrease',
  cascade: 'decrease',
  'new-min': 'decrease',
  children: 'extract',
  remove: 'extract',
  empty: 'extract',
  array: 'extract',
  root: 'extract',
  link: 'extract',
  store: 'extract',
  rebuild: 'extract',
};
