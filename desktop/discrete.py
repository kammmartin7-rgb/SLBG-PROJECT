"""Bounded discrete math operations for the desktop MCP service."""
import json
import sys
from pathlib import Path

# Bundled Python libraries are a fallback when the user's environment is empty.
libraries = Path(__file__).resolve().parents[1] / 'math-libraries'
if libraries.is_dir():
    sys.path.append(str(libraries))


def exact_integer_solution(equations):
    """Solve the supported two-variable linear system if native Z3 is unavailable."""
    from math import gcd
    rows = [(a, b, c) for a, b, c in equations if a or b]
    def answer(x, y):
        if all(a*x + b*y == c for a, b, c in equations):
            return {'status': 'sat', 'x': x, 'y': y, 'engine': 'integer arithmetic'}
        return {'status': 'unsat', 'engine': 'integer arithmetic'}
    if not rows:
        return answer(0, 0)
    a, b, c = rows[0]
    for d, e, f in rows[1:]:
        det = a*e - b*d
        if det:
            return answer((c*e-b*f)//det, (a*f-c*d)//det)
    g = gcd(a, b)
    if c % g:
        return {'status': 'unsat', 'engine': 'integer arithmetic'}
    if b == 0:
        return answer(c//a, 0)
    modulus = abs(b)//g
    x = 0 if modulus == 1 else ((c//g) * pow(a//g, -1, modulus)) % modulus
    return answer(x, (c-a*x)//b)


def calculate(operation, args):
    if operation == 'factor_polynomial':
        from sympy import Poly, Symbol
        x = Symbol('x')
        return str(Poly.from_list(args['coefficients'], gens=x).as_expr().factor())
    if operation == 'shortest_path':
        import networkx as nx
        graph = nx.Graph()
        graph.add_nodes_from([args['start'], args['end']])
        graph.add_edges_from(args['edges'])
        return nx.shortest_path(graph, args['start'], args['end'])
    if operation == 'integer_solution':
        try:
            from z3 import Int, Solver, sat, unsat
        except ModuleNotFoundError as error:
            if error.name != 'z3':
                raise
            return exact_integer_solution(args['equations'])
        x, y = Int('x'), Int('y')
        solver = Solver()
        solver.set(timeout=5000)
        for a, b, c in args['equations']:
            solver.add(a*x + b*y == c)
        result = solver.check()
        if result == unsat:
            return {'status': 'unsat'}
        if result != sat:
            return {'status': 'unknown'}
        model = solver.model()
        return {'status': 'sat', 'x': model.eval(x, model_completion=True).as_long(),
                'y': model.eval(y, model_completion=True).as_long()}
    raise ValueError('Unknown math tool')

if __name__ == '__main__':
    print(json.dumps(calculate(sys.argv[1], json.loads(sys.argv[2]))))
